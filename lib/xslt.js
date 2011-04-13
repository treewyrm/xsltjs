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
		
	};
	
	/**
	 * Document loader
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
		
		
		this.addEventListener("error", function error() {
			console.error(this.error);
		});
		
		this.addEventListener("change", function readystatechange() {
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
				this.error = exception;
				this.dispatchEvent("error");
			}
		});
		
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
				this.error = exception;
				this.dispatchEvent("error");
			}
		});		
	};
	
	/**
	 * Stylesheet loader and template processor
	 * 
	 * @prototype {DocumentLoader}
	 */
	var TemplateLoader = function() {
		this._listeners = clone(this._listeners);
		
		var load = this.load;
		
		this.load = function(url, timeout) {
			return load.call(this, url, timeout, window.ActiveXObject ? new ActiveXObject("Msxml2.FreeThreadedDOMDocument") : undefined); // IXSLProcessor explicitly requires free threaded document for stylesheet
		};
		
		/**
		 * Import external stylesheets
		 * 
		 * TODO: Implement xsl:include/xsl:import workaround
		 * 
		 */
		this.importStylesheets = function() {
			
		};
		
		/**
		 * Import external documents
		 * 
		 * TODO: Implement document() workaround
		 * 
		 */
		this.importDocuments = function() {
			
		};
		
		/**
		 * Performs transform with this stylesheet on input XML document
		 * 
		 * @param {document} input
		 * @param {boolean} async
		 * @param {boolean} cache
		 * @returns {number}
		 */
		this.transform = function(input, async, cache) {
			
			/**
			 * @default false
			 */
			var async = async || false;
			
			/**
			 * @default false
			 */
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
		};
		
		this.addEventListener("complete", function createProcessor(){
			if (window.XSLTProcessor) {
				this.processor = new XSLTProcessor();
				this.processor.importStylesheet(this.document);
			} else if (window.ActiveXObject) {
				this.template = new ActiveXObject("Msxml2.XSLTemplate");
				this.template.stylesheet = this.document;
				this.processor = this.template.createProcessor();
			}
			
			/**
			 * Cleaning up parameters list from "null" values" that used to remove parameters from previous execution
			 */
			for (var i = 0, l = this.parameters._list.length; i < l; i++) {
				if (this.parameters._list[i].value === null) {
					this.parameters._list[i] = undefined;
				}
			}
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
			if (typeof event == "string") {
				event = { type: event };
			}
			
			if (! event.target) {
				event.target = this;
			}
			
			if (this._listeners[event.type] instanceof Array) {
				var listeners = this._listeners[event.type];
				
				for (var i = 0, l = listeners.length; i < l; i++) {
					if (typeof listeners[i] == "function") {
						listeners[i].call(this, event);
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
	
	XSLTjs.prototype = EventTarget;
	DocumentLoader.prototype = EventTarget;
	TemplateLoader.prototype = new DocumentLoader();
	XSLTjs.Document.prototype = new DocumentLoader();
	XSLTjs.Template.prototype = new TemplateLoader();
	ResultTarget.prototype = new XSLTjs.Document();
	Result.prototype = new ResultTarget();
})();