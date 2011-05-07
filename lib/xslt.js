/**
 * JavaScript XSLT library
 * 
 */
(function(prefix) {
	var Options;
	var Events;
	var Request;
	var Document;
	var Parameters;
	var Result;
	var Stylesheet;
	
	/**
	 * AJAX request exception
	 * 
	 * @constructor
	 * @param {string} message Error description
	 * @param {string} url URL of requested object where error occured on
	 * @param {number} status HTTP status of requested file
	 */
	function RequestException(message, url, status) {
		this.message = message;
		this.url = url;
		this.status = status;
	}
	
	/**
	 * Event exception
	 * 
	 * @constructor
	 * @param {string} message Error description
	 */
	function EventException(message) {
		this.message = message;
	}
	
	function DocumentException(message) {
		this.message = message;
	}
	
	function StylesheetException(message) {
		this.message = message;
	}
	
	function ResultException(message) {
		this.message = message;
	}
	
	function QueryException(message) {
		this.message = message;
	}
	
	(function() {
		Options = function Options() {
			this.join = join;
			
			if (arguments.length > 0) {
				this.join.apply(this, arguments);
			}
		};
		
		/**
		 * Merge objects recursively
		 */
		function join() {
			if (typeof this !== "object") {
				return false;
			}
			
			var objects = arguments;
			
			for (var i = 0, l = objects.length; i < l; i++) {
				var object = objects[i];
				
				if (typeof object !== "object") {
					continue;
				}
				
				for (var p in object) {
					if (! object.hasOwnProperty(p) || p === join) {
						continue;
					}
					
					if (typeof this[p] == "object" && typeof object[p] == "object") {
						joinObjects.call(this[p], object[p]); 
					} else {
						this[p] = object[p];
					}
				}
			}
			
			return this;
		}		
	})(Options);
	
	(function() {
		
		/**
		 * Data request
		 * 
		 * @constructor
		 * @param {Document} requester
		 * @param {string} url
		 */
		Request = function Request(requester, url) {
			if (! (requester instanceof Document)) {
				throw new RequestException("Invalid requester type");
			}
			
			var requester = requester;
			var origin = location.protocol + "//" + location.host;
			
			this.request = url.substring(0, origin.length) == origin ? createRequest() : createXRequest();
			
			if (window.XDomainRequest && request instanceof XDomainRequest) {
				request.onerror = error;
				request.onload = complete;
				request.ontimeout = timeout;
				request.onprogress = function() {};
			}
			
			this.send = send;
			
			this.oncomplete;
			this.ontimeout;
		};
		
		/**
		 * Send request
		 *
		 * @this {Request}
		 * @param {string} data
		 */
		function send(data) {
			this.request.send(data);
		}
		
		/**
		 * Request factory
		 * 
		 * @return {XMLHttpRequest|ActiveXObject}
		 */
		function createRequest() {
			var methods = [ function() { return new XMLHttpRequest(); }, function() { return new ActiveXObject("Msxml2.XMLHTTP"); }, function() { return new ActiveXObject("Microsoft.XMLHTTP"); }];
			var request;
			
			for (var i = 0, l = methods.length; i < l; i++) {
				try {
					request = methods[i]();
				} catch (error) {
					continue;
				}
				
				createRequest = methods[i];
				return request;
			}
		}
		
		/**
		 * Cross-domain request factory
		 * 
		 * @return {XMLHttpRequest|XDomainRequest}
		 */
		function createXRequest() {
			if (! window.XDomainRequest) {
				return createRequest();
			}
			
			var request = new XDomainRequest();
			
		}
		
		
	})(Request);
	
	(function() {
		
		/**
		 * XML document
		 * 
		 * @constructor
		 * @param {string} url
		 */
		Document = function Document(url) {
			this.events = new Events();
			this.load = load;
			this.parse = parse;
			this.stylesheetURL = stylesheetURL;			
			this.root = root;
			
			if (url) {
				this.load(url);
			}
		};
		
		function root() {
			return getRoot(this);
		}
		
		/**
		 * Parse text string into XML
		 * 
		 * @this {Template}
		 * @param {string} source
		 * @param {string} url
		 * @return {boolean}
		 */
		function parse(source, url, parser) {
			if (typeof source == "string") {
				this.xml = parseStringIntoXML(source, parser);
			} else if (typeof source == "object") {
				this.xml = source;
			}
				
			this.url = url || location.href;
			this.timestamp = new Date();
			
			// Stylesheet sub document call
			if (!( this instanceof Stylesheet) && this.parent instanceof Stylesheet) {
				var root = this.root();
				
				root._documents.counter--;

				// Last document loaded and no more includes left
				if (root._documents.counter == 0 && !root._includes) {
					if (mergeDocumentsIntoStylesheet(root, root._documents) && root.events instanceof Events) {
						root.events.dispatchEvent(root, "complete");
					}
				}
			}
			
			return true;
		}
		
		/**
		 * Merge external documents into stylesheet
		 * 
		 * @param {Stylesheet} stylesheet
		 * @param {Includes} documents
		 * @return {boolean}
		 */
		function mergeDocumentsIntoStylesheet(stylesheet, documents) {
			try {
				
				if (! (stylesheet instanceof Stylesheet)) {
					throw new DocumentException("Invalid stylesheet reference");
				}
				
				if (! (documents instanceof Includes)) {
					throw new DocumentException("Invalid documents refcounter");
				}
				
				for (var i = 0, l = documents.length; i < l; i++) {
					var document = documents[i];
					
					if (! (document instanceof Document)) {
						continue;
					}
					
					var variable = window.ActiveXObject ? stylesheet.xml.createNode(1, 'xsl:variable', XSLTjs.namespaces.xsl) : stylesheet.xml.createElementNS(XSLTjs.namespaces.xsl, 'xsl:variable');
					variable.setAttribute("name", "XSLTjs-external-document-" + document.id);
					stylesheet.xml.documentElement.insertBefore(variable, stylesheet.xml.documentElement.firstChild);
					
					variable.appendChild("importNode" in stylesheet.xml ? stylesheet.xml.importNode(document.xml.documentElement, true) : document.xml.documentElement);
				}
				
				return true;
			} catch (exception) {
				stylesheet.events.dispatchEvent(stylesheet, "error", exception);
			}
		}
		
		/**
		 * Parse text string into XML document
		 * 
		 * TODO: Clean up
		 * 
		 * @param {string} source
		 * @return {Document}
		 */
		function parseStringIntoXML(source, object) {
			var parser;
			var output;
			
			try {
				if (typeof object == "object") {
					output = object;
					
					if (typeof object.parseFromString == "function") {
						object.parseFromString(source);
					} else if (window.ActiveXObject && object instanceof ActiveXObject) {
						object.async = false;
						object.loadXML(source);
					}
				} else if (window.DOMParser) {
					parser = new DOMParser;
					output = parser.parseFromString(source, "text/xml");
				} else if (window.ActiveXObject) {
					output = new ActiveXObject("Msxml2.DOMDocument");
					output.async = false;
					output.loadXML(source);
				}
				
				return output;
			} catch (exception) {
				throw exception;
			}
		}
		
		/**
		 * Looks for XSL style sheet processing instruction in document
		 * 
		 * @return {string}
		 */
		function stylesheetURL() {
			if (! ("childNodes" in this.xml)) {
				return false;
			}
			
			for (var i = 0, l = this.xml.childNodes.length; i < l; i++) {
				var node = this.xml.childNodes[i];
				
				if (node.nodeType == 7 && node.target == "xml-stylesheet") {
					if (node.data.search("type=\"text/xsl\"") != -1) {
						return node.data.match(/href="(.*)"/)[1];
					}
				} else if (node === this.xml.documentElement) { // Processing instructions should go above root element
					break;
				}
			}
			
			return false;
		}
		
		/**
		 * Load external XML file
		 * 
		 * @this {Document}
		 * @param {string} url
		 * @param {object} options
		 * @return {boolean}
		 */
		function load(url, options) {
			var requester = this;
			var request;
			var timeout;
			
			try {
				var options = new Options({
					method: "GET",
					async: true,
					data: null,
					timeout: 5000,
					callbacks: {
						timeout: requestTimeout,
						statechange: requestStateChange
					}
				}, options);
			
				
				if (typeof options.object == "undefined") {
					request = createRequest();
				}
				
				//request = options.object;
				url = absolutePathFrom(location.href, url);
				timeout = setTimeout(function() {

					try {
						options.callbacks.timeout.call(request, requester, url, timeout);
					} catch (exception) {
						requester.events.dispatchEvent(requester, "error", exception);
					}
				}, options.timeout);
								
				request.open(options.method, url, options.async, options.login, options.password);
				
				request.onreadystatechange = function onreadystatechange() {
					options.callbacks.statechange.call(request, requester, url, timeout);
				};

				for ( var name in options.headers) {
					if (!options.headers.hasOwnProperty(name)) {
						continue;
					}
					
					request.setRequestHeader(name, options.headers[name]);
				}
				
				request.send(options.data);
				
				return true;
			} catch (exception) {
				this.events.dispatchEvent(this, "error", exception);
			}
		}
		
		/**
		 * Create request
		 */
		function createRequest() {
			var methods = [ function() { return new XMLHttpRequest(); }, function() { return new ActiveXObject("Msxml2.XMLHTTP"); }, function() { return new ActiveXObject("Microsoft.XMLHTTP"); }];
			var request;
			
			for (var i = 0, l = methods.length; i < l; i++) {
				try {
					request = methods[i]();
				} catch (error) {
					continue;
				}
				
				createRequest = methods[i];
				return request;
			}
		}
				
		/**
		 * AJAX timeout callback
		 * 
		 * @this {XMLHttpRequest}
		 * @throws {RequestException}
		 */
		function requestTimeout(target, url, timeout) {
			if (this.readyState < 4) {
				this.abort();
				throw new RequestException("Timeout loading file", url, 0);
			}
		}
		
		/**
		 * AJAX request callback
		 * 
		 * @this {XMLHttpRequest}
		 */
		function requestStateChange(target, url, timeout) {
			try {
				switch (this.readyState) {
					case 2:
						if (target.events instanceof Events) {
							target.events.dispatchEvent(target, "headers", this);
						}
						
						break;
					case 4:
						if (this.status === 0) {
							return;
						}
						
						if (this.status !== 200) {
							throw new RequestException("Error loading file", url, this.status);
						}
						
						clearTimeout(timeout);
						
						if (this.responseText && typeof target.parse == "function") {
							
							if (target.parse(this.responseText, url) && target.events instanceof Events) {
								target.events.dispatchEvent(target, "complete", this);
							}
						} else {
							throw new RequestException("Invalid data", url, this.status);
						}
						
						break;
				}
			} catch (exception) {
				if (target.events instanceof Events) {
					target.events.dispatchEvent(target, "error", exception);
				} else {
					throw exception;
				}
			}
		}
		
	})(Document);
	
	(function() {
		
		/**
		 * XSLT processor parameters
		 * 
		 * @constructor
		 */
		Parameters = function Parameters() {
			
			/**
			 * @private
			 */
			this._list = [];
			
			this.set = set;
			this.remove = remove;
		};

		/**
		 * Add or modify XSL parameter
		 * 
		 * @this {Parameters}
		 * @param {string} name
		 * @param {string} value
		 * @param {string} namespaceURI
		 * @return {boolean}
		 */
		function set(name, value, namespaceURI) {
			var namespaceURI = namespaceURI || "";
			
			for (var i = 0, c = this._list.length; i < c; i++) {
				if (this._list[i].name === name && this._list[i].namespaceURI === namespaceURI) {
					this._list[i].value = value;
					return true;
				}
			}
			
			this._list.push({name: name, value: value, namespaceURI: namespaceURI});
			return true;
		}
		
		/**
		 * Remove XSL parameter
		 * 
		 * @this {Parameters}
		 * @param {string} name
		 * @param {string} namespaceURI
		 * @return {boolean}
		 */
		function remove(name, namespaceURI) {
			for (var i = 0, c = this._list.length; i < c; i++) {
				if (this._list[i].name === name && this._list[i].namespaceURI === namespaceURI) {
					this._list[i].value = null;
					return true;
				}
			}
			
			return false;
		}
	})(Parameters);
	
	(function() {
		
		/**
		 * Result document of XSLT processing
		 * 
		 * @constructor
		 * @param {Document} document
		 */
		Result = function Result(document) {
			if (! (document instanceof Document))
				throw new ResultException("Invalid document type");
				
			this.document = document;
			this.insertInto = insertInto;
			this.replace = replace;
		};
		
		function importNode(document, node) {
			if ("importNode" in document) {
				return document.importNode(node, true);
			}
			
			return node;
		}
		
		/**
		 * Insert result document into target element
		 * 
		 * @this {Result}
		 * @param {DOMElement} target
		 * @param {boolean} empty
		 * @returns {DOMElement}
		 */
		function insertInto(target, empty) {
			if (empty === true) {
				while (target.hasChildNodes()) {
					target.removeChild(target.firstChild);
				}
			}
			
			return target.appendChild(importNode(target.ownerDocument, this.document.xml.documentElement));
		}
		
		/**
		 * Replace target element with result document root
		 * 
		 * @this {Result}
		 * @param {DOMElement} target
		 * @returns {DOMElement}
		 */
		function replace(target) {
			target.parentNode.replaceChild(importNode(target.ownerDocument, this.document.xml.documentElement), target);
			return result;
		}
		
	})(Result);
	
	(function() {
		/**
		 * XSL style sheet
		 * 
		 * @constructor
		 * @param {string} url
		 * @param {object} parent
		 */
		Stylesheet = function Stylesheet(url) {
			this.events = new Events();
			
			this.parent = null;
			this.processInclusions = true;
			this.parameters = new Parameters();

			this.createStylesheet = createStylesheet;
			this.transform = transform;
			
			this.parse = parse;
			
			if (url) {
				this.load(url);
			}
		};
		
		/**
		 * Parse text string into XML and process inclusions and references
		 * 
		 * @this {Stylesheet}
		 * @param {string} source
		 * @param {string} url
		 * @return {boolean}
		 */
		function parse(source, url, parser) {
			var root = this.root();
			var self = this;
			
			// MSXML requires free threaded DOM document for XSLT processor
			Stylesheet.prototype.parse.call(this, source, url, window.ActiveXObject ? new ActiveXObject("Msxml2.FreeThreadedDOMDocument") : undefined);

			try {
				if (this.xml.documentElement.namespaceURI !== XSLTjs.namespaces.xsl) {
					throw new StylesheetException("Not a valid stylesheet");
				}
				
				// TODO: Merge namespaces from sub style sheets
				var attributes = this.xml.documentElement.attributes;
				var rootAttributes = root.xml.documentElement.attributes;
				var zs = [];
				
//				console.group("Checking %s", url);
				
				for (var z = 0, k = rootAttributes.length; z < k; z++) {
					var j = rootAttributes[z].nodeName || rootAttributes[z].baseName;
					zs.push(j);
				}
				
				for (var i = 0, l = attributes.length; i < l; i++) {
					var attribute = attributes[i];
					var name = attribute.nodeName || attribute.baseName;
					
					//console.log("%s -- %s -- %s", name, attribute.value, );
					
					if (! (zs.indexOf(name) != -1)) {
						root.xml.documentElement.setAttribute(name, attribute.nodeValue);
					}
				}
				
				// TODO: Add document refcounter
				
				var calls = query(this.xml.documentElement, "//xsl:*[contains(@select, \"document(\")]");
				
				if (calls.length > 0) {
					
					if (! (root._documents instanceof Includes)) {
						root._documents = new Includes();
						root._documents.links = [];
					}
					
					for (var i = 0, l = calls.length; i < l; i++) {
						var select = calls[i].getAttribute("select");
	
						// Determine if document link is a string or xpath
						select = select.replace(/document\('(.+)'\)/g, function(string, url) {
							var id;
							
							url = absolutePathFrom(self.url, url);
							id = root._documents.links.indexOf(url);
							
							// Document not in list
							if (id == -1) {
								var document = createDocument.call(self);
								
								id = root._documents.push(document);
								root._documents.counter++;
								id--;
								root._documents.links[id] = url;
								
								document.id = id;
								document.load(url);
							}
							
							return (window.ActiveXObject ? "msxml" : "exsl") + ":node-set($XSLTjs-external-document-" + id + ")";
						});
						
						calls[i].setAttribute("select", select);
					}
				}				
				
				if (this === root) {
					return injectStylesheets.call(this);
				} else if (root._includes instanceof Includes) {
					root._includes.push(this);
					root._includes.counter--;
					
					// Stich stylesheets together once all includes are loaded
					// This part is called once and at the last loaded include style sheet
					if (root._includes.counter == 0 && mergeStylesheets.call(root, root._includes)) {
						delete root._includes;
						
						// Have we found any document references while parsing?
						if (root._documents instanceof Includes) {
							injectDocuments.call(root);
						} else {
							root.events.dispatchEvent(root, "complete");
						}
					}
				}
				
				return false;
			} catch (exception) {
				this.root().events.dispatchEvent(this, "error", exception);
			}
		}
		
		/**
		 * Merge all includes into this document
		 * 
		 * @this {Stylesheet}
		 * @param {Includes} includes
		 * @return {Boolean}
		 */
		function mergeStylesheets(includes) {
				var self = this;
				
				for (var i = 0, l = includes.length; i < l; i++) {
					var fragment = includes[i].xml.createDocumentFragment();
					
					walkNodes(includes[i].xml.documentElement, [1, 8], function(node) {
						gatherNodesIntoFragment(fragment, node, self.xml);
					});
					
					this.xml.documentElement.appendChild(this.xml.createComment("xsl:" + includes[i].method + " from: " + includes[i].url));
					this.xml.documentElement.appendChild("importNode" in this.xml ? this.xml.importNode(fragment, true) : fragment);
				}
				
				return true;
		}
		
		/**
		 * 
		 * @param {DocumentFragment} fragment Fragment to collect node into
		 * @param {Node} node Gathered node
		 * @param {Document} document Target stylesheet document to process
		 */
		function gatherNodesIntoFragment(fragment, node, document) {
			if (node.nodeType != 1) {
				fragment.appendChild(node);
			}
			
			var name = node.localName || node.baseName; 
			
			// TODO: Do override checks and such
			if (name == "template") {
			}
			
			fragment.appendChild(node);
		}
		
		/**
		 * Create new sub stylesheet. Primarily used for nested inclusions.
		 * 
		 * @this {Stylesheet}
		 * @param {string} url
		 * @param {boolean} inheritEvents
		 * @return {Stylesheet}
		 */
		function createStylesheet(url, inheritEvents) {
			var stylesheet = new Stylesheet(url);
			stylesheet.parent = this;
			
			if (inheritEvents === true) {
				stylesheet.events = new Events(stylesheet, this.events);
			}
			
			return stylesheet;
		}
		
		/**
		 * Create new sub document
		 * 
		 * @this {Stylesheet}
		 * @param {string} url
		 * @return {Document}
		 */
		function createDocument(url) {
			var document = new Document(url);
			document.parent = this;
			
			return document;
		}
		
		/**
		 * Manually inject external style sheets referenced by xsl:include and xsl:import
		 * 
		 * @this {Stylesheet}
		 * @param {boolean} recursive
		 */
		function injectStylesheets(recursive) {
			var recursive = recursive || true;
			var self = this;
			var root = this.root();			
			
			try {
				if (this.processInclusions === false) {
					return true;
				}
				
				if (!(root._includes instanceof Includes)) {
					root._includes = new Includes();
				}
				
				// Walk style sheet tree looking for inclusions 
				walkNodes(this.xml.documentElement, function(node) {
					
					// Inclusion must be element and must be XSL namespace
					if (node.nodeType != 1 || node.namespaceURI != XSLTjs.namespaces.xsl) {
						return false;
					}
					
					var name = node.localName || node.baseName;
					
					if (name != "import" && name != "include") {
						return false;
					}				

					return true;
				}, function(node) {
					var stylesheet;
					
					root._includes.counter++;
					
					// Create new sub style sheet
					stylesheet = createStylesheet.call(self, absolutePathFrom(self.url, node.getAttribute("href")));
					stylesheet.method = node.localName || node.baseName;
					
					// Remove xsl:include/import from document
					node.parentNode.removeChild(node); 
				});
				
				return root._includes.counter == 0;
				
			} catch (exception) {
				
				// Errors must be redirected to root style sheet
				root.events.dispatchEvent(this, "error", exception);
			}
		}
		
		/**
		 * Set msxml/exsl
		 */
		function injectDocuments() {
			try {
				var extensions = this.xml.documentElement.getAttribute("extension-element-prefixes") || "";
				var extension = window.ActiveXObject ? "msxml" : "exsl";
				
				if (extensions.indexOf(extension) == -1) {
					this.xml.documentElement.setAttribute("extension-element-prefixes", extensions.length > 0 ? exensions + " " + extension : extension);
					
					if (! this.xml.documentElement.getAttribute("xmlns:" + extension)) {
						this.xml.documentElement.setAttribute("xmlns:" + extension, XSLTjs.namespaces[extension]);
					}
				}
				
				// Reset document to catch up with newely defined extensions
				
				this.xml = (new DOMParser()).parseFromString(((new XMLSerializer()).serializeToString(this.xml)), "text/xml");
				
				return true;
			} catch (exception) {
				this.events.dispatchEvent(this, "error", exception);
			}
		}
		
		/**
		 * Transform source document with this stylesheet
		 * 
		 * @this {Stylesheet}
		 * @param {Document} document
		 * @param {boolean} async
		 * @param {boolean} cache
		 * @return {boolean}
		 */
		function transform(document, async, cache) {
			try {
				var self = this;
				
				if (! this.processor) {
					initializeProcessor.call(this);
				}
				
				if (! (document instanceof Document)) {
					throw new StylesheetException("Wrong document type");
				}
				
				if (async === true) {
					if (document.xml) { // Document XML is ready, process it 
						setTimeout(function() {
							processDocument.call(self, document, cache);
						}, 0);
					} else { // Schedule processing when document XML will be ready
						document.events.addEventListener("complete", function delayedProcess(event) {
							event.remove();							
							processDocument.call(self, event.target, cache);
						}, 1);
					}
				} else {
					if (! document.xml) {
						throw new StylesheetException("Document not ready");
					}
					
					processDocument.call(this, document);
				}
			} catch (exception) {
				this.events.dispatchEvent(this, "error", exception);
			}
		}
		
		/**
		 * Process input document
		 * 
		 * @this {Stylesheet}
		 * @param {Document} document
		 * @param {boolean} cache
		 */
		function processDocument(document, cache) {
			try {
				var result;
				var output;
				
				setParameters(this.parameters, this.processor);
				
				output = new Document();
				
				if (window.XSLTProcessor) {
					output.parse(this.processor.transformToDocument(document.xml));
				} else if (window.ActiveXObject) {
					this.processor.input = document.xml;
					this.processor.transform();
					
					output.parse(this.processor.output);
				}
				
				result = new Result(output);
				
				this.events.dispatchEvent(this, "transform", result);
			} catch (exception) {
				this.events.dispatchEvent(this, "error", exception);
			}
		}
		
		/**
		 * Initialize client-side XSLT processor
		 * 
		 * @throws StylesheetException
		 */
		function initializeProcessor() {
			try {
				var template;
				
				if (! this.xml) {
					throw new StylesheetException("Stylesheet is not ready");
				}
				
				//applyExtensions.call(this);
				
				if (window.XSLTProcessor) { // Mozilla and compatibles way
					this.processor = new XSLTProcessor();
					this.processor.importStylesheet(this.xml);
				} else if (window.ActiveXObject) { // Microsoft way
					template = new ActiveXObject("Msxml2.XSLTemplate");
					template.stylesheet = this.xml;
					this.processor = template.createProcessor();				
				}
				
				this.events.dispatchEvent(this, "ready");
				return true;
			} catch (exception) {
				this.events.dispatchEvent(this, "error", exception);
			}
		}
		
		/**
		 * Set XSL parameters to processor
		 * 
		 * @param {Parameters} parameters
		 * @param {XSLTProcessor} processor
		 */
		function setParameters(parameters, processor) {
			if (! (parameters instanceof Parameters)) {
				throw new StylesheetException("Invalid parameters");
			}
			
			for (var i = 0, l = parameters._list.length; i < l; i++) {
				var parameter = parameters._list[i];
				
				if (typeof parameter == "undefiend") {
					continue;
				}
				
				if (window.XSLTProcessor) {
					if (parameter.value === null) {
						processor.removeParameter(parameter.namespaceURI, parameter.name);
					}
				
					processor.setParameter(parameter.namespaceURI, parameter.name, parameter.value);
				} else if (window.ActiveXObject) {
					processor.addParameter(parameter.name, parameter.value, parameter.namespaceURI);
				}
			}
		}			
	})(Stylesheet);
	
	/**
	 * Events
	 */
	(function() {

		/**
		 * Events collection
		 * 
		 * @constructor
		 * @param {Events} parent
		 */
		Events = function Events(parent) {

			/**
			 * @private
			 */
			this._listeners = new Listeners();
			
			/**
			 * Copy listeners from parent events collection
			 */
			if (parent instanceof Events) {
				for ( var name in parent._listeners) {
					this._listeners[name] = parent._listeners[name];
				}
			}
			
			this.addEventListener = addEventListener;
			this.dispatchEvent = dispatchEvent;
			this.removeEventListener = removeEventListener;
		};
		
		function Listeners() {

		}
		
		/**
		 * Event listener callback
		 * 
		 * @constructor
		 * @param {Events} events
		 * @param {function} callback
		 * @param {number} limit
		 */
		function EventListener(events, callback, limit) {
			this.events = events;
			this.callback = callback;
			this.limit = parseInt(limit);
			this.dispatch = listenerDispatch;
		}
		
		/**
		 * Dispatch event listener
		 * 
		 * @this {EventListener}
		 * @param {Event} event
		 * @param {Array} parameters
		 * @return {boolean}
		 */
		function listenerDispatch(event, parameters) {
			if (!isNaN(this.limit)) {
				if (this.limit <= 0) {
					return false;
				}
				
				this.limit--;
			}
			
			event.listener = this;
			parameters.unshift(event);
			
			this.callback.apply(this, parameters);
			return true;
		}
		
		/**
		 * Event handler
		 * 
		 * @constructor
		 * @param {EventListener} listener
		 * @param {string} type
		 * @param {object} target
		 */
		function Event(type, target) {
			this.listener;
			this.type = type;
			this.target = target;
			
			this.stop = function() {

			};
			
			this.remove = function() {
				this.listener.events.removeEventListener(this.type, this.listener);
			};
		}
		
		/**
		 * Adds event listener
		 * 
		 * @this {Events}
		 * @param {string} type
		 * @param {function} listener
		 * @param {number} limit
		 * @return {EventListener}
		 */
		function addEventListener(type, listener, limit) {
			if (typeof listener !== "function") {
				throw new EventException("Invalid listener type");
			}
			
			if (typeof this._listeners[type] == "undefined") {
				this._listeners[type] = [];
			}
			
			var eventListener = new EventListener(this, listener, limit);
			
			this._listeners[type].push(eventListener);
			
			return eventListener;
		}
		
		/**
		 * Run event
		 * 
		 * @this {Events}
		 * @param {object} target
		 * @param {Event} event
		 * @return {number} A number of events dispatched
		 * @throws {EventException}
		 */
		function dispatchEvent(target, event) {
			var listeners;
			var counter = 0;
			
			// Save extra parameters to pass into listener callback
			var parameters = Array.prototype.slice.call(arguments, 2);
			
			// Set event object to pass back listener callback
			if (typeof event == "string") {
				var event = new Event(event, target);
			} else if (!(event instanceof Event)) {
				throw new EventException("Invalid event dispatch");
			}
			
			// Are there any listeners of this type?
			if (this._listeners[event.type] instanceof Array) {
				var listeners = this._listeners[event.type];
			
				// Run through listeners of this type
				for ( var i = 0, l = listeners.length; i < l; i++) {
					if (listeners[i] instanceof EventListener) {
						if (listeners[i].dispatch(event, parameters)) {
							
							// Count successful dispatches
							counter++;
						}
					}
				}
			}
			
			return counter;
		}
		
		/**
		 * Removes all matching listeners of a specified type
		 * 
		 * @this {Events}
		 * @param {string} type
		 * @param {EventListener} listener Event Listener to search
		 * @return {number} A number of listeners matched
		 * @throws {EventException}
		 */
		function removeEventListener(type, listener) {
			var listeners;
			var counter = 0;
			
			// A listener must be proper object
			if (!(listener instanceof EventListener)) {
				throw new EventException("Invalid listener type");
			}			
			
			// Are there any listeners of this type?
			if (!(this._listeners[type] instanceof Array)) {
				return false;
			}
			
			listeners = this._listeners[type];
			
			// Run through listeners looking for specified and delete any match
			for ( var i = 0, l = listeners.length; i < l; i++) {
				if (listeners[i] === listener) {
					delete listeners[i];
					counter++;
				}
			}
			
			return counter;
		}
	})(Events);
	
	/**
	 * Get top parent
	 * 
	 * @param {Document} object
	 * @return {Document}
	 */
	function getRoot(object) {
		if (! (object.parent) || ! (object.parent instanceof Document)) {
			return object;
		} else {
			return getRoot(object.parent);
		}
	}
	
	/**
	 * Converts relative target path to absolute from origin path Origin path
	 * although not necessarily but recommended to be absolute, target path if
	 * absolute already will return itself.
	 * 
	 * @param {string} origin Starting absolute path
	 * @param {string} target Target relative path
	 * @return {string}
	 */
	function absolutePathFrom(origin, target) {
		var separator = "\/";
		var path;
		
		// Return target url if it is already absolute
		if (target.search(/^.+:\/\//) != -1) {
			return target;
		}
		
		// Set up url base for target (protocol and everything till first separator)
		path = origin.substring(0, (target.charAt(0) == separator ? origin.indexOf(separator, origin.indexOf(":\/\/") + 3) : origin.lastIndexOf(separator) + 1));
		
		// Walk through directory nodes of a target url
		for ( var i = 0, a = target.split(separator), l = a.length; i < l; i++) {
			if (a[i] == "..") { // Go one level up
				path = path.substring(0, path.lastIndexOf(separator, path.length - (path.charAt(path.length - 1) == separator ? 2 : 0)) + 1);
			} else if (a[i] == ".") { // Remain at same level (do nothing)
			} else { // Add level down
				path += a[i] + (i == l - 1 ? "" : separator);
			}
		}
		
		return path;
	}
	
	/**
	 * Walk through node children
	 * 
	 * Nodes can be altered dynamically
	 * 
	 * @param {Node} node Node children to walk through
	 * @param {Array|function} filter Filter nodes by type or custom filter
	 * @param {function} callback Call function for each node
	 * @param {Boolean} recursive Recursively walk node tree
	 * @return {Number} Number of nodes processed
	 */
	function walkNodes(node, filter, callback, recursive) {
		var recursive = recursive || false;
		var current = node.firstChild || null;
		var next, counter = 0, limit = 1024;
		
		if (filter instanceof Array) {
			var types = filter;
			
			filter = function(node) {
				return types.indexOf(node.nodeType != -1);
			};
		} else if (typeof filter !== "function") {
			throw ResultException("Invalid filter type");
		}
		
		while (current !== null) {
			next = current.nextSibling; // Set next node
			
			if (! filter(current)) { // Filter by node type
				current = next;
				continue;
			}
			
			counter++;
			
			if (counter > limit) { // Prevent infinite loops
				break;
			}
			
			if (current.hasChildNodes() && recursive) { // Recursive walk
				counter += walkNodes(current, filter, callback, recursive);
			}
			
			if (typeof callback == "function") {
				callback(current);
			}
			
			current = next;
		}
		
		return counter;
	}
	
	/**
	 * XPath query
	 * 
	 * @param {Node} node
	 * @param {string} query
	 * @param {object} namespaces
	 * @returns {Array}
	 */
	function query(node, query, namespaces) {
		try {
			var namespaces = namespaces || XSLTjs.namespaces;
			var document = node.documentElement ? node : node.ownerDocument; 
			var result;
			var n, z;
			
			if (typeof document.evaluate == "function") {
				result = document.evaluate(query, node, function(prefix) {
					if (prefix in namespaces) {
						return namespaces[prefix];
					}
				}, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
			} else if ("selectNodes" in node) { 
				var namespaceString = "";
				
				document.setProperty("SelectionLanguage", "XPath");
				
				for (var prefix in namespaces) {
					if (! (namespaces.hasOwnProperty(prefix) && typeof namespaces[prefix] == "string" && prefix !== "xml")) {
						continue;
					}
					
					namespaceString += "xmlns:" + prefix + "=\"" + namespaces[prefix] + "\" ";
				}
				
				document.setProperty("SelectionNamespaces", namespaceString);
				result = node.selectNodes(query);
			}
			
			if (window.XPathResult && result instanceof XPathResult) {
				z = [];
				
				while (n = result.iterateNext()) {
					z.push(n);
				}
				
				return z;
			}
			
			return result;
		} catch (exception) {
			console.error(exception);
		}
	}
	
	/**
	 * Inclusion refcounter
	 */
	function Includes() {
		this.counter = 0;
	}
	
	Includes.prototype = new Array();
	
	function XSLTjs() {
		this.createDocument = createDocument;
		this.createStylesheet = createStylesheet;
		this.extensions = new Extensions();
	}
	
	function Extensions() {
		this.functions = {};
		this.elements = {};
		
		this.createFunction = createFunction;
		this.createElement = createElement;
	}
	
	function createFunction(name, callback) {
		this.functions[name] = callback;
	}
	
	function createElement() {
		
	}
	
	XSLTjs.namespaces = {
		"xml": "http://www.w3.org/XML/1998/namespace",
		"xhtml": "http://www.w3.org/1999/xhtml",
		"xsl": "http://www.w3.org/1999/XSL/Transform",
		"xsi": "http://www.w3.org/2001/XMLSchema-instance",
		"exsl": "http://exslt.org/common",
		"msxml": "urn:schemas-microsoft-com:xslt",
		"xsltjs": "http://www.xsltjs.com"		
	};
	
	XSLTjs.settings = {
		XSLTProcessor: Boolean(window.XSLTProcessor),
		ActiveX: Boolean(window.ActiveXObject)
	};
	
	/**
	 * Create new document object
	 * 
	 * @return {Document}
	 */
	function createDocument() {
		var document = new Document();
		document.parent = this;
		return document;
	}
	
	/**
	 * Create new stylesheet object
	 * 
	 * @return {Stylesheet}
	 */
	function createStylesheet() {
		var stylesheet = new Stylesheet();
		stylesheet.parent = this;
		return stylesheet;
	}
	
	Stylesheet.prototype = new Document();
	
	if (!window[prefix]) {
		window[prefix] = XSLTjs;
	}
})("XSLTjs");