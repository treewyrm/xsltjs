/**
 * JavaScript XSLT library
 * 
 * Copyright (c) 2011 Yuriy Alekseyev <treewyrm@gmail.com>
 */

/**
 * @namespace JavaScript XSLT library namespace
 */
var XSLTjs;

(function(){
	XSLTjs = function XSLTjs() {
		this._listeners = {};
	};
	
	/**
	 * List of predefined namespaces
	 */
	XSLTjs.namespaces = {
		"xml": "http://www.w3.org/XML/1998/namespace",
		"xhtml": "http://www.w3.org/1999/xhtml",
		"xsl": "http://www.w3.org/1999/XSL/Transform",
		"xsi": "http://www.w3.org/2001/XMLSchema-instance",
		"exsl": "http://exslt.org/common",
		"msxml": "urn:schemas-microsoft-com:xslt",
		"xsltjs": "http://www.xsltjs.com"
	};
	
	/**
	 * Creates a new source document 
	 * 
	 * @class Source document
	 * @returns {XSLTjs.Document}
	 */
	XSLTjs.Document = function Document() {
		this._listeners = clone(this._listeners);
	};
	
	/**
	 * Creates a new template
	 * 
	 * @class Stylesheet/template and processor
	 * @returns {XSLTjs.Template}
	 */
	XSLTjs.Template = function Template() {
		this._listeners = clone(this._listeners);
		this.parameters = new Parameters();
		this.results = [];
		this.includes = [];
		this.includes.counter = 0;
	};
	
	/**
	 * Subtemplate requests
	 * 
	 */
	var SubTemplate = function() {
		this._listeners = clone(this._listeners);
	};
	
	var SubDocument = function() {
		this._listeners = clone(this._listeners);
	};
	
	/**
	 * Document loader
	 * 
	 * Events: error, change, timeout, complete
	 * 
	 */
	var DocumentLoader = function() {
		this._listeners = {};
		
		/**
		 * Looks for processing instruction containing link for stylesheet
		 * 
		 * @returns {string}
		 */
		this.getStylesheetURL = function() {
			if (! ("childNodes" in this.document)) {
				return false;
			}
			
			for (var i = 0, d = this.document.childNodes.length; i < d; i++) {
				var node = this.document.childNodes[i];
				
				if (node.nodeType == 7 && node.target == "xml-stylesheet") { // Node.PROCESSING_INSTRUCTION_NODE
					if (node.data.search("type=\"text/xsl\"") != -1) {
						return node.data.match(/href="(.*)"/)[1];
					}
				} else if (node === this.document.documentElement) {
					break;
				}
			}
			
			return false;
		};
		
		/**
		 * Asynchronously load external document
		 * 
		 * @param {string} url
		 * @param {number} timeout
		 * @param {object} object
		 */
		this.load = function(url, timeout, object) {
			var self = this;
			var timeout = timeout || 1600;
			
			this.url = url;
			
			if (typeof object === "object") {
				this.request = object;
			} else if (window.XMLHttpRequest) {
				this.request = new XMLHttpRequest();
			} else if (window.ActiveXObject) {
				this.request = new ActiveXObject("Msxml2.XMLHTTP");
			}
	
			this.timeout = setTimeout(function() {
				self.dispatchEvent("timeout");
			}, timeout);
	
			this.request.onreadystatechange = function() {
				self.dispatchEvent("change");
			};
			
			if ("overrideMimeType" in this.request) {
				this.request.overrideMimeType("text/xml");
			}
					
			if ("open" in this.request) { // XMLHttpRequest
				this.request.open("GET", this.url, true);
				return this.request.send(null);
			} else if ("load" in this.request) { // XMLDOM
				return this.request.load(this.url);
			}
		};
		
		/**
		 * Parses text string into document object
		 * 
		 * @param {string} source
		 * @param {object} object
		 * @returns {object}
		 */
		this.parseStringIntoDocument = function(source, object) {
			var parser;
			
			if (window.DOMParser && typeof object == "undefined") {
				parser = new DOMParser();
				
				return parser.parseFromString(source, "text/xml");
			} else if (window.ActiveXObject) {
				result = typeof object == "object" ? object : new ActiveXObject("Msxml2.DOMDocument");
				result.async = false;
				result.loadXML(source);
				
				return result;
			} else {
				throw {
					name: "XSLTjsError",
					description: "Cannot parse string into document"
				};
			}
		};
		
		/**
		 * Asynchronous state change listener
		 */
		this.addEventListener("change", function readystatechange(event) {
			var error;
			
			try {
				if (this.request.readyState == 4) {
					if ("parseError" in this.request) {
						error = this.request.parseError;
					}
					
					clearTimeout(this.timeout);
					delete this.timeout;
					
					if (error && error.errorCode !== 0) {
						throw {
							name: "XMLParseError",
							message: "(" + error.errorCode + ") " + error.reason + " at line " + error.line + " position " + error.linepos + " of file " + url,
							request: this.url
						};
					}
					
					if ("status" in this.request && this.request.status != 200) {
						throw {
							name: "RequestError",
							message: "Unable to load document (" + this.url + ")",
							request: this.url
						};
					}
					
					this.document = "responseXML" in this.request ? this.request.responseXML : this.request;
					this.dispatchEvent("complete");
					
					return true;
				} else {
					return false;
				}
			} catch(exception) {
				this.dispatchEvent("error", exception);
			}
		});
		
		/**
		 * Timeout listener
		 */
		this.addEventListener("timeout", function timeout() {
			try {
				if (this.request.readyState < 4) {
					this.abort();
					throw {
						name: "TimeoutError",
						message: "Timeout limit exceeded at loading (" + this.url + ")"
					};
				}
			} catch(exception) {
				this.dispatchEvent("error", exception);
			}
		});		
	};
	
	/**
	 * Stylesheet loader and template processor
	 * 
	 * Events: error, change, timeout, complete, transform, loading
	 * 
	 */
	var TemplateLoader = function() {
		this._listeners = clone(this._listeners);
		
		var load = this.load;
		
		var includeLinks = [];
		
		/**
		 * Load stylesheet from url (overriden for template) 
		 * 
		 * @param {string} url
		 * @param {number} timeout
		 */
		this.load = function(url, timeout, object) {
			
			/**
			 * Cleaning up parameters list from "null" values" that used to remove parameters from previous execution
			 */
			if (this.parameters) {
				for (var i = 0, l = this.parameters._list.length; i < l; i++) {
					if (this.parameters._list[i].value === null) {
						this.parameters._list[i] = undefined;
					}
				}
			}

			/**
			 * IXSLProcessor explicitly requires free threaded document for stylesheet
			 */
			var object = object || window.ActiveXObject ? new ActiveXObject("Msxml2.FreeThreadedDOMDocument") : undefined;
			
			return load.call(this, url, timeout, object);
		};
		
		/**
		 * Import external stylesheets
		 * 
		 * TODO: Implement xsl:include/xsl:import workaround
		 * TODO: Store request URLs to prevent endless include/import loop
		 * 
		 */
		this.injectStylesheets = function() {
			try {
				var self = this;
				var root = getTopOrigin(this);
				
				walkNodes(this.document.documentElement, function(node) {
					if (node.nodeType != 1 || node.namespaceURI != XSLTjs.namespaces.xsl) {
						return false;
					}
					
					var name = node.localName || node.baseName;
					
					if (name != "import" && name != "include") {
						return false;
					}				

					return true;
				}, function(node) {
					root.includes.counter++;
					createSubTemplate.call(self, node.getAttribute("href"), node.localName || node.baseName);
					node.parentNode.removeChild(node);
				});
				
				return (root.includes.counter > 0);
			} catch (exception) {
				this.dispatchEvent("error", exception);
			}
		};
		
		/**
		 * Import external documents
		 * 
		 * TODO: Implement document() workaround
		 * 
		 */
		this.injectDocuments = function() {
			
		};
		
		/**
		 * Performs transform with this stylesheet on input XML document
		 * 
		 * @param {document} input
		 * @param {boolean} async
		 * @param {boolean} cache
		 */
		this.transform = function(input, async, cache) {
			var self = this;
			var async = async || true;
			
			if (async == true) {
				setTimeout(function() {
					transform.call(self, input, cache);
				}, 0);
			} else {
				return transform.call(self, input, cache);
			}
			
			return true;
		};
		
		/**
		 * Once stylesheet is loaded successfully the template will initialize XSLT processors
		 */
		this.addEventListener("complete", function initProcessor(event) {
			// Check for xsl:include and document() in stylesheet
			if (! this.injectStylesheets() && this instanceof XSLTjs.Template) {
				createProcessor.call(this);
				this.dispatchEvent("ready");
			}
			
			if (! (this instanceof XSLTjs.Template))
				return true;
		});
	};
	
	var Parameters = function() {
		this._list = [];
	};
	
	Parameters.prototype = {
		/**
		 * Add or modify XSL parameter
		 * 
		 * @param {string} name
		 * @param {string} value
		 * @param {string} namespaceURI
		 */
		set: function(name, value, namespaceURI) {
			
			/**
			 * @default ""
			 */
			var namespaceURI = namespaceURI || "";
			
			for (var i = 0, c = this._list.length; i < c; i++) {
				if (this._list[i].name === name && this._list[i].namespaceURI === namespaceURI) {
					this._list[i].value = value;
					return true;
				}
			}
			
			this._list.push({name: name, value: value, namespaceURI: namespaceURI});
			return true;
		},
		
		/**
		 * Remove XSL parameter
		 * 
		 * @param {string} name
		 * @param {string} namespaceURI
		 */
		remove: function(name, namespaceURI) {
			for (var i = 0, c = this._list.length; i < c; i++) {
				if (this._list[i].name === name && this._list[i].namespaceURI === namespaceURI) {
					this._list[i].value = null;
					return true;
				}
			}
			
			return false;
		}
	};
	
	/**
	 * Result object with document tree
	 * 
	 * @returns {Result}
	 */
	var Result = function Result(result, input, template) {
		this.document = result;
		this.input = input;
		this.template = template;
	};
	
	var ResultTarget = function() {
		this.importResult = function(target) {
			if (! ("importNode" in target.ownerDocument) && window.ActiveXObject) {
				return this.document.documentElement;
			}
			
			return target.ownerDocument.importNode(this.document.documentElement, true);
		};
		
		/**
		 * Insert result document into target element
		 * 
		 * @param {DOMElement} target
		 * @param {boolean} empty
		 * @returns {DOMElement}
		 */
		this.insertInto = function(target, empty) {
			if (empty === true) {
				while (target.hasChildNodes()) {
					target.removeChild(target.firstChild);
				}
			}
			
			return target.appendChild(this.importResult(target));
		};
		
		/**
		 * Replace target element with result document root
		 * 
		 * @param {DOMElement} target
		 * @returns {DOMElement}
		 */
		this.replace = function(target) {
			var result = this.importResult(target);
			
			target.parentNode.replaceChild(result, target);
			return result;
		};
	};
	
	var EventTarget = {
		
		/**
		 * Add event listener to object
		 * 
		 * @param {string} type
		 * @param {function} listener
		 */
		addEventListener: function(type, listener) {
			if (typeof this._listeners[type] == "undefined") {
				this._listeners[type] = [];
			}
			
			this._listeners[type].push(listener);
		},
		
		/**
		 * Dispatch event to all listeners of its type
		 * 
		 * @param {string} event
		 */
		dispatchEvent: function(event) {
			var args = Array.prototype.slice.call(arguments, 1);
			var halt = false;
			
			if (typeof event == "string") {
				event = {
					type: event,
					stopPropagation: function() {
						halt = true;
					}
				};
			}
			
			if (! event.target) {
				event.target = this;
			}
			
			args.unshift(event);
			
			if (this._listeners[event.type] instanceof Array) {
				var listeners = this._listeners[event.type];
				
				for (var i = 0, l = listeners.length; i < l; i++) {
					if (typeof listeners[i] == "function" && halt === false) {
						listeners[i].apply(this, args);
					}
				}
			}
		},
		
		/**
		 * Remove an event from specified type
		 * 
		 * @param {string} type
		 * @param {function} listener
		 */
		removeEventListener: function(type, listener) {
		}
	};
	
	/**
	 * Utility clone function
	 * 
	 * @param {object} object
	 * @returns {object}
	 */
	var clone = function clone(object) {
		var clonedObject = (object instanceof Array) ? [] : {};
		
		for (var i in object) {
			if (i == 'clone') continue;
			
			if (object[i] && typeof object[i] == "object") {
				clonedObject[i] = clone(object[i]);
			} else {
				clonedObject[i] = object[i];
			}
		}
		
		return clonedObject;
	};
	
	function getTopOrigin(object) {
		if (! object.origin)
			return object;
		
		return getTopOrigin(object.origin);
	}
	
	/**
	 * Create new subtemplate
	 * 
	 * @param {String} target
	 * @param {String} method Method by which subtemplate should be processed ("include" or "import");
	 */
	function createSubTemplate(target, method) {
		var template = new SubTemplate();
		var origin = this.document.url || this.document.documentURI;
		var root = getTopOrigin(this);
		var path = absolutePathFrom(origin, target);
		root.dispatchEvent("loading", path);
		
		template.origin = this;
		template.method = method;
		template.load(path);
		template.addEventListener("complete", onSubtemplateComplete);
	}
	
	/**
	 * Process subtemplates
	 * 
	 * @param {Event} event
	 * @return {Boolean}
	 */
	function onSubtemplateComplete(event) {
		try {
			var root = getTopOrigin(event.target);
			root.includes.push(event.target);
			root.includes.counter--;
			
			if (root.includes.counter == 0) {
				return mergeStylesheets(root);
			}
		} catch (exception) {
			root.dispatchEvent("error", exception);
		}
	}
	
	/**
	 * Merge all includes into main stylesheet document
	 * 
	 * @param {XSLTjs.Template} template
	 * @return {Boolean}
	 */
	function mergeStylesheets(template) {
		try {
			var includes = template.includes;
			
			for (var i = 0, l = includes.length; i < l; i++) {
				var fragment = includes[i].document.createDocumentFragment();
				var origin = fragment.ownerDocument.url || fragment.baseURI;
				var method = includes[i].method;
				
				walkNodes(includes[i].document.documentElement, [1, 8], function(node) {
					gatherNodesIntoFragment(fragment, node, template.document);
				});
	
				template.document.documentElement.appendChild(template.document.createComment("xsl:" + method + " from: " + origin));
				template.document.documentElement.appendChild("importNode" in template.document ? template.document.importNode(fragment, true) : fragment);
			}
			
			template.includes = []; // Reset includes
			template.includes.counter = 0; // Reset counter
			
			return createProcessor.call(template);
		} catch (exception) {
			template.dispatchEvent("error", exception);
		}
	}
	
	/**
	 * 
	 * @param {DocumentFragment} fragment Fragment to collect node into
	 * @param {Node} node Gathered node
	 * @param {Document} document Target stylesheet document to process
	 * 
	 */
	function gatherNodesIntoFragment(fragment, node, document) {
		if (node.nodeType != 1) {
			return fragment.appendChild(node);
		}
		
		var name = node.localName || node.baseName; 
		
		if (name == "template") {
		}
		
		fragment.appendChild(node);
	}
	
	/**
	 * Create and initialize processor 
	 * 
	 */
	function createProcessor() {
		try {
			if (! this.document) {
				throw {
					name: "Error",
					message: "Stylesheet is not ready"
				};
			}
			
			if (window.XSLTProcessor) {
				this.processor = new XSLTProcessor();
				this.processor.importStylesheet(this.document);
			} else if (window.ActiveXObject) {
				this.template = new ActiveXObject("Msxml2.XSLTemplate");
				this.template.stylesheet = this.document;
				this.processor = this.template.createProcessor();				
			}
			
			this.dispatchEvent("ready");
			return true;
		} catch (exception) {
			this.dispatchEvent("error", exception);
		}
	}
	
	/**
	 * Performs transform with this stylesheet on input XML document
	 * 
	 * @param {document} input
	 * @param {boolean} cache
	 * @returns {number}
	 */
	function transform(input, cache) {
		try {
			var async = async || false;
			var cache = cache || false;
			var output;
			var mozilla = window.XSLTProcessor && this.processor instanceof XSLTProcessor;
			var msxml = window.ActiveXObject;
			
			if (! this.processor) {
				throw {
					name: "XSLTjsError",
					message: "Not ready yet"
				};
			}
			
			if (! (input instanceof XSLTjs.Document)) {
				throw {
					name: "XSLTjsError",
					message: "Wrong document type"
				};
			}
			
			for (var i = 0, l = this.parameters._list.length; i < l; i++) {
				var parameter = this.parameters._list[i];
				
				if (typeof parameter == "undefiend") {
					continue;
				}
				
				if (mozilla) {
					if (parameter.value === null) {
						this.processor.removeParameter(parameter.namespaceURI, parameter.name);
					}
				
					this.processor.setParameter(parameter.namespaceURI, parameter.name, parameter.value);
				} else if (msxml) {
					this.processor.addParameter(parameter.name, parameter.value, parameter.namespaceURI);
				}
			}
			
			if (mozilla) {
				output = this.processor.transformToDocument(input.document);
			} else if (msxml) {
				this.processor.input = input.document;
				this.processor.transform();
				
				output = this.parseStringIntoDocument(this.processor.output);
			}
					
			this.result = new Result(output, input, this);
			
			this.dispatchEvent("transform");
	
			if (cache === true) {
				return this.results.push(this.result);
			}
	
			return true;
		} catch (exception) {
			this.dispatchEvent("error", exception);
		}
	}	
	
	/**
	 * Converts relative target path to absolute from origin path
	 * 
	 * Origin path although not necessarily but recommended to be absolute, target path if absolute already will return itself.
	 * 
	 * @param {string} origin Starting absolute path
	 * @param {string} target Target relative path
	 * @returns {string}
	 */
	function absolutePathFrom(origin, target) {
		var separator = "\/";
		var start = origin;
		var path;
		
		if (target.search(/^.+:\/\//) != -1)
			return target;
		
		path = origin.substring(0, (target.charAt(0) == separator ? origin.indexOf(separator, origin.indexOf(":\/\/") + 3) : origin.lastIndexOf(separator) + 1));
		
		for (var i = 0, a = target.split(separator), l = a.length; i < l; i++) {
			if (a[i] == "..") {
				path = path.substring(0, path.lastIndexOf(separator, path.length - (path.charAt(path.length - 1) == separator ? 2 : 0)) + 1);
			} else {
				path += a[i] + (i == l - 1 ? "" : separator);
			}
		}
		
		return path;
	}
	
	/**
	 * Walk through node children
	 * 
	 * @param {Node} node Node children to walk through
	 * @param {Array} filter Filter nodes by node type (can also be a filtering function)
	 * @param {function} callback Call function for each node
	 * @param {Boolean} recursive Recursively walk node tree
	 * @returns {Number} Number of nodes processed
	 */
	function walkNodes(node, filter, callback, recursive) {
		var recursive = recursive || false;
		var n = node.firstChild || null, k, f, i = 0, limit = 1024;
		
		if (typeof filter == "function") {
			f = filter;
		} else if (filter instanceof Array) {
			f = function(n) {
				var fx = filter;
				
				return fx.indexOf(n.nodeType) != -1;
			};
		}
		
		while (n !== null) {
			if (! f(n)) { // Filter by node type
				n = n.nextSibling;
				continue;
			}
			
			i++;
			
			if (i > limit) { // Prevent infinite loops
				break;
			}
			
			k = n.nextSibling; // Save next node in case current one is going to be removed
	
			if (n.hasChildNodes() && recursive) {
				i += walkNodes(n, f, callback, recursive);
			}
			
			if (typeof callback == "function") {
				callback(n);
			}
			
			n = n.parentNode ? n.nextSibling : k;
		}
		
		return i;
	};

	XSLTjs.prototype = EventTarget;
	
	DocumentLoader.prototype = EventTarget;
	TemplateLoader.prototype = new DocumentLoader();
	
	XSLTjs.Document.prototype = new DocumentLoader();
	XSLTjs.Template.prototype = new TemplateLoader();
	
	SubTemplate.prototype = new TemplateLoader();
	SubDocument.prototype = new DocumentLoader(); 
	
	ResultTarget.prototype = new XSLTjs.Document();
	Result.prototype = new ResultTarget();
})();