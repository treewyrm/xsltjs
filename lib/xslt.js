/**
 * JavaScript XSLT library
 * 
 */
function XSLTJS() {
	if (! (this instanceof arguments.callee))
		throw "Object must be instanced first";
	
	/**
	 * Fires on exception
	 */
	this.onerror = undefined;
	
	/**
	 * Fires when transformation has been completed
	 * 
	 * @param xslt XSLTJS
	 */
	this.ontransform = undefined;
	
	/**
	 * Fires when both XML and XSL are loaded but prior to processor configuration
	 * 
	 * @param xslt XSLTJS
	 * @param xml Document
	 * @param xsl Document
	 */
	this.onready = undefined;
	
	/**
	 * XML document
	 * 
	 * @type Document
	 */
	var xml;
	
	/**
	 * XSL document
	 * 
	 * @type Document
	 */
	var xsl;
	
	/**
	 * XSLT processor
	 * 
	 * @type XSLTProcessor
	 * @type IXSLProcessor
	 */
	var processor;
	
	/**
	 * XML template for MSXML
	 * 
	 * @type IXSLTemplate
	 */
	var template;
	
	/**
	 * XML DOM parser
	 * 
	 * @type DOMParser
	 */
	var parser;
	
	var that = this;
	
	var mode = {
		hasXSLTProcessor: Boolean(window.XSLTProcessor),
		hasActiveX: Boolean(window.ActiveXObject),
		hasDOMParser: Boolean(window.DOMParser),
		hasXMLSerializer: Boolean(window.XMLSerializer),
		hasXMLHttpRequest: Boolean(window.XMLHttpRequest)
	};

	
	this.namespaces = {};
	
	/**
	 * Predefined commonly used namespaces and prefixes
	 */
	this.namespaces.list = {
		"xml": "http://www.w3.org/XML/1998/namespace",
		"xhtml": "http://www.w3.org/1999/xhtml",
		"xsl": "http://www.w3.org/1999/XSL/Transform",
		"xsi": "http://www.w3.org/2001/XMLSchema-instance",
		"exsl": "http://exslt.org/common",
		"msxml": "urn:schemas-microsoft-com:xslt",
		"xsltjs": "http://www.xsltjs.com"
	};
	
	/**
	 * Add/modify namespace
	 * 
	 * @param prefix string
	 * @param URI string
	 * @returns boolean
	 */
	this.namespaces.add = function(prefix, URI) {
		this.list[prefix] = URI;
		return true;
	};
	
	/**
	 * Remove namespace by prefix
	 * 
	 * @param prefix string
	 * @returns boolean
	 */
	this.namespaces.remove = function(prefix) {
		delete this.list[prefix];
		return true;
	};
	
	/**
	 * XSL parameters
	 * 
	 * @type Array
	 */
	this.parameters = [];

	/**
	 * Add/modify parameter
	 * 
	 * @param name string
	 * @param value string
	 * @param namespaceURI
	 * @returns boolean
	 */
	this.parameters.set = function(name, value, namespaceURI) {
		for (var i = 0, c = this.length; i < c; i++) {
			if (this[i].name === name && this[i].namespaceURI === namespaceURI) {
				this[i].value = value;
				return true;
			}
		}
		
		this.push({name: name, value: value, namespaceURI: namespaceURI});
		return true;
	};
	
	/**
	 * Remove parameter
	 * 
	 * @param name string
	 * @param namespaceURI string
	 * @returns boolean
	 */
	this.parameters.remove = function(name, namespaceURI) {
		for (var i = 0, c = this.length; i < c; i++) {
			if (this[i].name === name && this[i].namespaceURI === namespaceURI) {
				this[i].value = null;
				return true;
			}
		}
		
		return false;
	};
	
	this.results = [];
	
	function exceptionHandler(exception) {
		if (typeof that.onerror == "function") {
			that.onerror(exception);
		} else
			throw exception;
	}

	/**
	 * Loads and imports external documents into nodesets
	 * 
	 * @returns boolean
	 */
	var importDocuments = function() {
		
	};
	
	/**
	 * Loads and imports external stylesheets into main stylesheet
	 * 
	 * @returns boolean
	 */
	var importStylesheets = function() {
		
	};
	
	/**
	 * Parse string into document
	 * 
	 * @param string string
	 * @param object object
	 * @returns object
	 */
	function parseStringIntoDOM(string, object) {
		if (mode.hasDOMParser && typeof object == "undefined") {
			if (! (parser instanceof DOMParser)) {
				parser = new DOMParser();
			}
			
			return parser.parseFromString(string, "text/xml");
		} else if (mode.hasActiveX) {
			result = typeof object == "object" ? object : new ActiveXObject("Msxml2.DOMDocument");
			result.async = false;
			result.loadXML(string);
			
			return result;
		} else {
			throw {
				name: "XSLTJSError",
				description: "Cannot parse string into document"
			};
		}
	}

	/**
	 * Set XSL parameter (add/modify/remove)
	 * 
	 * @param name string
	 * @param value string
	 * @param namespaceURI string
	 * @returns boolean
	 */
	function setParameter(name, value, namespaceURI) {
		var namespaceURI = namespaceURI || "";
		
		if (mode.hasXSLTProcessor) {
			if (value === null) {
				return processor.removeParameter(namespaceURI, name);
			}
		
			return processor.setParameter(namespaceURI, name, value);
		} else if (mode.hasActiveX) {
			return processor.addParameter(name, value, namespaceURI);
		}
	}
	
	/**
	 * Check for readiness to transform
	 * 
	 * @returns boolean
	 */
	function checkReadiness() {
		if (typeof xml == "undefined" || typeof xsl == "undefined") {
			return false;
		}
		
		if (checkReadiness.caller !== that.transform) {
			that.onready(that, xml, xsl);
		} else {
			for (var i = 0, v = that.parameters.length; i < v; i++) { // Apply parameters to processor
				setParameter(that.parameters[i].name, that.parameters[i].value, that.parameters[i].namespaceURI);
			}			
		}
		
		return true;
	}
	
	/**
	 * Asynchronously load external document
	 * 
	 * @param url string
	 * @param callback function
	 * @param timeout number
	 * @param object object
	 * @returns boolean
	 */
	function load(url, callback, timeout, object) {
		var request;
		var timer;
		var timeout = timeout || 1600;
		
		if (typeof object === "object") {
			request = object;
		} else if (mode.hasXMLHttpRequest) {
			request = new XMLHttpRequest();
		} else if (mode.hasActiveX) {
			request = new ActiveXObject("Msxml2.XMLHTTP");
		}

		timer = setTimeout(function() {
			requestTimeout(request, url);
		}, timeout);
		
		request.onreadystatechange = function() {
			requestResult(request, url, timer, callback);
		};
		
		if ("overrideMimeType" in request) {
			request.overrideMimeType("text/xml");
		}
		
		if ("open" in request) { // XMLHttpRequest
			request.open("GET", url, true);
			return request.send(null);
		} else if ("load" in request) { // XMLDOM
			return request.load(url);
		}
	}
	
	/**
	 * Callback for asynchronous calls
	 * 
	 * @param request object
	 * @param url string
	 * @param timer number
	 * @param callback function
	 */
	function requestResult(request, url, timer, callback) {
		var error;
		
		try {
			if (request.readyState == 4) {
				if ("parseError" in request) { // DOMXML request
					error = request.parseError;
				}
				
				clearTimeout(timer);
				
				if (error && error.errorCode !== 0) {
					throw {
						name: "XMLParseError",
						message: "(" + error.errorCode + ") " + error.reason + " at line " + error.line + " position " + error.linepos + " of file " + url,
						request: url
					};
				}
				
				if ("status" in request && request.status != 200) {
					throw {
						name: "RequestError",
						message: "Unable to load document (" + url + ")",
						request: url
					};
				}
				
				callback("responseXML" in request ? request.responseXML : request);
			}
		} catch(exception) {
			exceptionHandler(exception);
		}
	}
	
	/**
	 * Callback for asynchronous calls timeouts
	 * 
	 * @param request object
	 * @param url string
	 */
	function requestTimeout(request, url) {
		try {
			if (request.readyState < 4) {
				request.abort();
				throw {
					name: "TimeoutError",
					message: "Timeout limit exceeded at loading (" + url + ")"
				};
			}
		} catch(exception) {
			exceptionHandler(exception);
		}
	}
	
	/**
	 * Set document
	 * 
	 * @param document mixed
	 */
	this.document = function(document) {
		var parser;
		
		if (typeof document === "string") {
			xml = parseStringIntoDOM(document);
		} else if (document instanceof Document || "xml" in document) {
			xml = document;
		} else {
			throw {
				name: "DocumentError",
				message: "Invalid XML type",
				url: this.url
			};
		}
		
		if (typeof this.onready == "function") {
			this.onready(that, xml);
		}
		
		return checkReadiness();
	};
	
	/**
	 * Load document asynchronously
	 * 
	 * @param url string
	 */
	this.document.load = function(url, timeout) {
		var context = this;
		this.url = url;
		
		return load(url, function(document) {
			context.call(context, document);
		}, timeout);
	};
	
	/**
	 * Reset document
	 * 
	 */
	this.document.reset = function() {
		xml = undefined;
	};
	
	/**
	 * Callback on document ready state
	 * 
	 * @param xslt XSLTJS
	 * @param xml Document
	 */
	this.document.onready = undefined;
	
	/**
	 * Set stylesheet
	 * 
	 * @param stylesheet mixed
	 */
	this.stylesheet = function(stylesheet) {
		var parser;
		
		if (typeof stylesheet === "string") {
			xsl = parseStringIntoDOM(stylesheet, new ActiveXObject("Msxml2.FreeThreadedDOMDocument"));
		} else if (stylesheet instanceof Document || "xml" in stylesheet) {
			xsl = stylesheet;
		} else {
			throw {
				name: "DocumentError",
				message: "Invalid XSL type",
				url: this.url
			};
		}
		
		if (typeof this.onready == "function") {
			this.onready(that, xsl);
		}
		
		if (mode.hasXSLTProcessor) {
			processor = new XSLTProcessor();
			processor.importStylesheet(xsl);
		} else if (mode.hasActiveX) {
			template = new ActiveXObject("Msxml2.XSLTemplate");
			template.stylesheet = xsl;
			processor = template.createProcessor();
		}
		
		return checkReadiness();
	};
	
	/**
	 * Load stylesheet asynchronously
	 * 
	 * @param url string
	 * @param timeout number
	 */
	this.stylesheet.load = function(url, timeout) {
		var context = this;
		this.url = url;
		
		var callback = function(document) {
			context.call(context, document);
		};
		
		return load(url, callback, timeout, mode.hasActiveX ? new ActiveXObject("Msxml2.FreeThreadedDOMDocument") : undefined); // IXSLProcessor explicitly requires free threaded document for stylesheet
	};
	
	/**
	 * Reset stylesheet
	 * 
	 */
	this.stylesheet.reset = function() {
		xsl = undefined;
	};
	
	/**
	 * Callback on stylesheet ready state
	 * 
	 * @param xslt XSLTJS
	 * @param xsl Document
	 */
	this.stylesheet.onready = undefined;
    
	/**
	 * Reset all
	 * 
	 */
	this.reset = function() {
		xml = undefined;
		xsl = undefined;
	};
	
	/**
	 * Result object
	 * 
	 * @param output
	 * @returns Result
	 */
	var Result = function(output) {
		var result = this.data = output;
		
		this.document = that.document.url;
		this.stylesheet = that.stylesheet.url;
		
		/**
		 * Remove all child nodes from target node
		 * 
		 * @param node Node
		 * @returns boolean
		 */
		var emptyNode = function(node) {
			while (node.hasChildNodes()) {
				node.removeChild(node.firstChild);
			}
			
			return true;
		};
		
		/**
		 * Check target node if it is valid
		 * 
		 *  @param node Node
		 *  @returns boolean
		 */
		var checkNode = function(node) {
			if (node === null || ! ("nodeType" in node) || node.nodeType != 1) {
				throw {
					name: "XSLTJSException",
					message: "Invalid target. Must be element."
				};
			}
			
			return true;
		};
		
		/**
		 * Get 
		 * 
		 * 
		 */
		var getContent = function(node) {
			if (! ("importNode" in node.ownerDocument) && mode.hasActiveX) {
				return result.documentElement;
			}
			
			return node.ownerDocument.importNode(result.documentElement, true);
		};
		
		/**
		 * Appends result into target node
		 * 
		 * @param target Node
		 * @param empty boolean
		 * @returns boolean
		 */
		this.insertInto = function(target, empty) {
			checkNode(target);
			
			if (empty === true) {
				emptyNode(target);
			}
			
			return target.appendChild(getContent(target));
		};
		
		/**
		 * Replaces target node with result
		 * 
		 * @param target
		 */
		this.replace = function(target) {
			var result = getContent(target);
			checkNode(target);
			target.parentNode.replaceChild(result, target);
			return result;
		};
	};
	
	/**
	 * Transform document
	 * 
	 * @return boolean
	 */
	this.transform = function() {
		var output;
		var parser;
		
		if (! checkReadiness()) {
			throw {
				name: "XSLTJSError",
				message: "Not ready yet"
			};
		}
		
		if (mode.hasXSLTProcessor) {
			output = processor.transformToDocument(xml);
		} else if (mode.hasActiveX) {
			processor.input = xml;
			processor.transform();
			
			output = parseStringIntoDOM(processor.output);
		}
	
		this.results.push(this.lastResult = new Result(output));
	
		if (typeof this.ontransform == "function") {
			return this.ontransform(this, this.lastResult);
		}
		
		return true;
	};
}

XSLTJS.script = function(callback) {
	if (typeof callback != "function")
		throw "Invalid script callback function";
	
	return callback();
};