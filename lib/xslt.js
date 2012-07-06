/**
 * XSLTjs, JavaScript XSLT library
 * 
 * Copyright (c) 2012 Yuriy Alexeev, http://xsltjs.com/
 * Licensed under MIT license.
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. 
 */
(function XSLTjsLibrary(prefix) {
	
	// Client browser features
	var browser = new TestCollection();
	browser.load('supports');

	/**
	 * Merge two or more relative or absolute paths
	 * 
	 * @param {string} path 
	 * @returns {string}
	 */
	function combinePaths() {
		var separator = "\/", path, result;

		// Parse each path passed into arguments
		for (var i = 0, l = arguments.length; i < l; i++) {
			path = arguments[i];

			// Return target url if it is already absolute
			if (path.search(/^.+:\/\//) != -1) {
				result = path;
				continue;
			}

			// Set up url base for target (protocol and everything till first separator)
			
			// TODO: May not have a slash at the end
			// result.indexOf(separator, result.indexOf(":\/\/") + 3) will have -1 as there are no slashes after ://
			// in case of that the value must be result.length
			/*
			var b = result.indexOf(separator, result.indexOf(":\/\/") + 3);
			
			if (b == -1) {
				b = result.length;
			}
			*/
			
			result = result.substring(0, (path.charAt(0) == separator ? result.indexOf(separator, result.indexOf(":\/\/") + 3) : result.lastIndexOf(separator) + 1));

			// Walk through directory nodes of a target url
			for (var c = 0, s = path.split(separator), e = s.length; c < e; c++) {
				if (s[c] == "..") { // Go one level up
					result = result.substring(0, result.lastIndexOf(separator, result.length - (result.charAt(result.length - 1) == separator ? 2 : 0)) + 1);
				} else if (s[c] == ".") { // Remain at same level (do nothing)
				} else { // Add level down
					result += s[c] + (c == e - 1 ? "" : separator);
				}
			}
		}

		return result;
	}
	
	/**
	 * Test collection
	 * 
	 * @constructor
	 * @returns {TestCollection}
	 */
	function TestCollection() {
		this.tests = []; // Test performed
		this.test = addTest;
		this.save = saveTests;
		this.load = loadTests;
	}
	
	/**
	 * Test
	 * 
	 * @constructor
	 * @returns {Test}
	 */
	function Test(callback) {
		if (typeof callback != 'function') {
			throw new Error('Invalid test type');
		}
		
		this.callback = callback;
		this.result = undefined;
		this.error = undefined;
		this.run = runTest;
	}
	
	/**
	 * Execute test
	 * 
	 * @this {Test}
	 * @returns {boolean}
	 */
	function runTest() {
		try {
			this.callback();
			this.result = true;
		} catch (error) {
			this.error = error;
			this.result = false;
		}
		
		return true;
	}
	
	/**
	 * Add and execute a test
	 * 
	 * @this {TestCollection}
	 * @param {function} callback
	 * @returns {boolean}
	 */
	function addTest(callback) {
		var test = new Test(callback);
		
		this.tests.push(test);
		
		if (typeof this.cache == 'number') {
			test.result = Boolean(this.cache & (1 << (this.tests.length - 1)));
		} else {
			test.run();
		}
		
		return test.result;
	}
	
	/**
	 * Save test results into cookie
	 * 
	 * @this {TestCollection}
	 * @returns {boolean}
	 */
	function saveTests(name) {
		var test;
		var flags;
		
		for (var i = 0, l = this.tests.length; i < l; i++) {
			test = this.tests[i];
			
			if (test.result == true) {
				flags |= 1 << i;
			}
		}
		
		document.cookie = prefix + '.' + name + '=' + flags.toString(16).toUpperCase() + ';;path=/';
		return true;
	}
	
	/**
	 * Load test results from cookie
	 * 
	 * @this {TestCollection}
	 * @returns {boolean}
	 */
	function loadTests(name) {
		var matches = document.cookie.match(new RegExp(prefix + '.' + name + '=([0-9A-F]+)'));
		
		if (matches) {
			this.cache = parseInt(matches[1], 16);
		}
		
		return true;
	}
	
	/**
	 * Event model object
	 * 
	 * @constructor
	 * @returns {EventCollection}
	 */
	function EventCollection() {
		this.listeners = {}; // Event listeners
		this.errors = []; // Error log
		this.addEventListener = addEventListener;
		this.removeEventListener = removeEventListener;
		this.dispatchEvent = dispatchEvent;
	}

	/**
	 * Event object
	 * 
	 * Event object is passed to callback as first argument.
	 * 
	 * @constructor
	 * @returns {Event}
	 */
	function Event() {
		this.type = undefined;
		this.target = undefined;
	}

	/**
	 * Event listener constructor
	 * 
	 * @constructor
	 * @param {function} callback Function to call when event is triggered
	 * @returns {EventListener}
	 * @throws {Error}
	 */
	function EventListener(callback) {
		if (typeof callback !== 'function') {
			throw new Error('Invalid callback type');
		}

		this.callback = callback;
		this.limit = NaN;
		this.counter = 0;
	}

	/**
	 * Add event listener
	 * 
	 * @this {EventCollection}
	 * @param {string} type Event name
	 * @param {function} callback Function to call when event is triggered
	 * @returns {EventListener}
	 * @throws {Error}
	 */
	function addEventListener(type, callback) {
		var listener, listeners = this.listeners[type] || (this.listeners[type] = []);

		listeners.push(listener = callback instanceof EventListener ? callback : new EventListener(callback));
		return listener;
	}

	/**
	 * Remove event listener
	 * 
	 * @this {EventCollection}
	 * @param {string} type Event name
	 * @param {EventListener} listener Event listener to remove from the stack
	 * @returns {number} Number of listeners removed from the stack
	 */
	function removeEventListener(type, listener) {
		var listeners = this.listeners[type];
		var removed = 0;

		for (var i = 0, l = listeners.length; i < l; i++) {
			if (listeners[i] === listener) {
				delete listeners[i];
				removed++;
			}
		}

		return removed;
	}

	/**
	 * Dispatch event
	 * 
	 * @this {EventCollection}
	 * @param {string} type Event name
	 * @returns {number} Number of events dispatched
	 * @throws {Error} Only if there is no error handler specified
	 */
	function dispatchEvent(type, error) {
		var observer = this;
		var listeners = this.listeners[type];
		var listener;
		var event;
		var parameters = Array.prototype.slice.call(arguments, 1);
		var dispatched = 0;
		var halt = false;

		if (! listeners || ! (listeners instanceof Array)) {
			return false;
		}

		for (var i = 0, l = listeners.length; i < l; i++) {
			listener = listeners[i];

			if (! (listener instanceof EventListener) || typeof listener.callback != 'function') {
				continue;
			}

			if (! isNaN(listener.limit)) {
				if (listener.counter >= listener.limit) {
					// delete listeners[i];
					continue;
				}
			}

			listener.counter++;

			event = new Event();
			event.type = type;

			// For old browsers compatibility only
			event.target = dispatchEvent.caller || arguments.callee.caller;

			// Set a method for event to remove own event listener from the object
			event.removeListener = (function () {
				var eventListener = listener;
				
				return function removeListener() {
					return observer.removeEventListener(type, eventListener);
				};
			}());

			event.haltExecution = function haltExecution() {
				halt = true;
			}

			// Set event object as first argument for callback arguments list
			parameters.unshift(event);
			listener.callback.apply(this, parameters);
			dispatched++;

			if (halt) {
				break;
			}
		}
		
		// Collect garbage and restructure array
		for (var i in listeners) {
			if (! (listeners.hasOwnProperty(i))) {
				continue;
			}
			
			if (typeof listeners[i] == 'undefined') {
				listeners.splice(i, 1);
			}
		}

		// Error events will be passed outside if no error handler is set
		if (type == 'error') {
			if (dispatched == 0) {
				throw error;
			} else {
				this.errors.push(error);
			}
		}

		return dispatched;
	}
	
	/**
	 * Document wrapper
	 * 
	 * Events: headers, loaded, complete, error
	 * 
	 * @constructor
	 * @param {number} type
	 * @returns {Document}
	 */
	function Document(type) {
		this.listeners = {}; // Event listeners
		this.headers = {}; // HTTP request headers
		this.errors = [];
		
		this.url = undefined; // URL of external document
		this.parent = undefined; // Parent document
		this.document = null; // Actual document
		this.type = type || Document.TYPE_DOCUMENT; // Document type (internal object type)
		this.timeout = 5000; // External document request timeout
		this.method = 'GET'; // HTTP request method
		this.async = true; // Asynchronous request
		this.cache = false; // Allow browsers to cache request
		this.stripWhitespace = true; // Strip whitespace text nodes between elements
		this.state = 0; // Current document state
		
		this.isReady = isReady;
		this.abort = abortProcessing;
		this.root = rootDocument; // Root document (used for nested inclusions)
		this.load = loadDocument; // Load document from URL
		this.parse = parseDocument; // Parse document XML
		this.source = documentSource; // Get source XML string
		this.getStylesheets = getStylesheets; // Get associated stylesheets from processing instructions
		this.insert = insertInto; // Inject result into other document.
	}
	
	Document.TYPE_DOCUMENT = 0;
	Document.TYPE_MSXML_DOCUMENT = 1;
	Document.TYPE_MSXML_FREETHREADED_DOCUMENT = 2;
	
	Document.STATE_ERROR = -1;
	Document.STATE_UNINITIALIZED = 0;
	Document.STATE_INITIALIZED = 1;
	Document.STATE_HEADERS = 2;
	Document.STATE_LOADING = 3;
	Document.STATE_COMPLETE = 4;
	
	/**
	 * Root document
	 * 
	 * @this {Document}
	 * @returns {Document}
	 */
	function rootDocument() {
		if (! (this.parent) || ! (this.parent instanceof Document)) {
			return this;
		} else {
			return this.parent.root();
		}
	}
	
	/**
	 * Abort all current processing
	 * 
	 * @this {Document}
	 * @returns {boolean}
	 */
	function abortProcessing() {
		if (this.state > Document.STATE_UNINITIALIZED && this.state != Document.STATE_COMPLETE) {
			
			// TODO: Need to figure out how to stop actions at each step.
			
			this.state = Document.STATE_UNINITIALIZED;
			return true;
		}
	}
	
	function isReady() {
		return this.state == Document.STATE_COMPLETE;
	}
	
	/**
	 * Parse document XML
	 * 
	 * @this {Document}
	 * @param {string} source
	 * @returns {boolean}
	 */
	function parseDocument(source) {
		var document;
		
		// Documents still parsing will deny reloading XML
		if (this.state > Document.STATE_INITIALIZED && this.state != Document.STATE_COMPLETE) {
			throw new Error('Document parsing in progress');
		}
		
		if (this.stripWhitespace === true) {
			source = source.replace(/>(\W+)</g, '><');
		}
		
		switch (this.type) {
			case (Document.TYPE_MSXML_DOCUMENT):
			case (Document.TYPE_MSXML_FREETHREADED_DOCUMENT):
				document = new ActiveXObject(this.type == Document.TYPE_MSXML_DOCUMENT ? 'Msxml2.DOMDocument' : 'Msxml2.FreeThreadedDOMDocument');
				document.async = false;
				document.loadXML(source);
				
				// Internet Explorer error handling
				if (document.parseError.errorCode != 0) {
					throw new Error('Error parsing XML: ' + document.parseError.reason);
				}
				
				break;
			case (Document.TYPE_DOCUMENT):
			default:
				if (XSLTjs.supports.DOMPARSER) {
					document = (new DOMParser()).parseFromString(source, 'text/xml');
				}
			
				// Mozilla Firefox error handling
				if (document.documentElement.nodeName == 'parsererror' && document.documentElement.namespaceURI == 'http://www.mozilla.org/newlayout/xml/parsererror.xml') {
					throw new Error('Error parsing XML: ' + document.documentElement.textContent);
				}
				
				break;
		}
		
		this.document = document;
		return true;
	}
	
	/**
	 * Get XML from remote location
	 * 
	 * @this {Document}
	 * @param {string} url
	 * @returns {boolean}
	 */
	function loadDocument(url, data) {
		var self = this;
		var now = new Date();
		var request, source, document, timeout;
		
		// Documents still loading/processing will deny loading
		if (this.state > Document.STATE_INITIALIZED && this.state != Document.STATE_COMPLETE) {
			throw new Error('Document loading in progress');
		}
		
		url = url || this.url;
		
		if (typeof url == 'undefined') {
			throw new Error('Request URL not specified');
		}
		
		this.url = url = combinePaths(window.location.href, url);
		delete this.document;
		
		// Document initialized and ready for request
		this.state = Document.STATE_INITIALIZED;
		
		if (! this.cache) {
			url += (url.indexOf('?') > -1 ? '&' : '?') + '_' + (new Date()).getTime().toString(16); // Check if there are GET parameters in URL already
		}
		
		// Create HTTP request object
		request = XSLTjs.supports.XMLHTTPREQUEST ? new XMLHttpRequest() : new ActiveXObject('Msxml2.XMLHTTP');
		request.open(this.method, url, Boolean(this.async));
		
		// Set HTTP request headers
		if ('setRequestHeader' in request) {
			for (var name in this.headers) {
				if (this.headers.hasOwnProperty(name)) {
					request.setRequestHeader(name, this.headers[name]);
				}
			}
			
			// TODO: Perhaps send XSL parameters into headers as well?
		}
		
		this.dispatchEvent('beforesend');
		
		// Set state change listener for request
		request.onreadystatechange = function readyStateChange() {
			try {
				self.state = request.readyState;
				
				switch (request.readyState) {
					case (0): // Uninitialized (before open)
					case (1): // Loading (request underway)
						break;
					case (2): // Loaded (headers retrieved)
						self.dispatchEvent('headers', request);
						break;
					case (3): // Interactive (partial data available)
						break;
					case (4): // Complete (all done)
						if (request.status == 0) { // HTTP code
							return;
						}

						clearTimeout(timeout);
						self.dispatchEvent('loaded', request);
						
						if (request.status != 200) {
							throw new Error('Error loading file');
						}
						
						self.errors = [];
						
						if (self.parse(request.responseText)) {
							self.dispatchEvent('complete');
						}
				}
			} catch (error) {
				self.state = Document.STATE_ERROR;
				self.dispatchEvent('error', error);
			}
		};
		
		// Set request timeout
		timeout = setTimeout(function requestTimeout() {
			if (request.readyState < Document.STATE_COMPLETE) {
				request.abort();
				self.dispatchEvent('error', new Error('Request timeout'));
			}
		}, this.timeout);
		
		// Send request
		return request.send(data);	
	}
	
	/**
	 * Get XML source
	 * 
	 * @this {Document}
	 * @returns {string}
	 */
	function documentSource() {
		if (this.document instanceof window.Document) {
			return (new XMLSerializer()).serializeToString(this.document);
		} else if (XSLTjs.supports.MSXML_DOCUMENT && this.document instanceof ActiveXObject) {
			return this.document.xml;
		} else {
			throw new Error('No valid document');
		}
	}
	
	/**
	 * Get stylesheets associated with a document
	 * 
	 * @this {Document}
	 * @returns {Array}
	 */
	function getStylesheets() {
		var node, parameters, stylesheet, matches;
		var regex = /([\w]+)="([\w\.\/]+)"/gi;
		var stylesheets = [];

		for (var i = 0, l = this.xml.childNodes.length; i < l; i++) {
			node = this.xml.childNodes[i];

			// Node type 7 is a processing instruction
			if (node.nodeType == 7 && node.target == 'xml-stylesheet') {
				stylesheets.push(stylesheet = {});

				while (matches = regex.exec(node.data)) {
					stylesheet[matches[1]] = matches[2];
				}

			} else if (node === this.xml.documentElement) {
				// Processing instructions are always above document element
				break;
			}
		}

		return stylesheets;		
	}
	
	/**
	 * 
	 * @this {Document}
	 * @param {Element} target
	 * @returns {Element}
	 */
	function insertInto(target) {
		var result;

		if (! (target instanceof Element)) {
			throw new Error('Invalid target type');
		}
		
		// Some XML facilities in certain versions of Internet Explorer do not have importNode method, instead allowing applying foreign nodes directly. This is a non-standard behaviour.
		result = 'importNode' in target.ownerDocument ? target.ownerDocument.importNode(this.document.documentElement, true) : this.document.documentElement;
		
		target.appendChild(result);
		return true;
	}
	
	/**
	 * Stylesheet parameter
	 * 
	 * @constructor
	 * @param {string} name
	 * @param {string} value
	 * @param {string} namespaceURI
	 * @returns {StylesheetParameter}
	 */
	function StylesheetParameter(name, value, namespaceURI) {
		this.name = name;
		this.value = value;
		this.namespaceURI = namespaceURI || '';
	}
	
	/**
	 * Stylesheet
	 * 
	 * Events: preprocessed, transformed, substylesheet, subdocument
	 * 
	 * @constructor
	 * @param {number} type Document type
	 * @returns {Stylesheet}
	 */
	function Stylesheet(type) {
		this.listeners = {}; // Event listeners
		this.headers = {}; // HTTP request headers
		this.parameters = []; // Stylesheet parameters
		this.includes = []; // Includes/imports/documents
		this.errors = [];
		
		// IXSLTemplate accepts only free-threaded documents
		this.type = (XSLTjs.supports.MSXML_TEMPLATE && XSLTjs.supports.MSXML_FREETHREADED_DOCUMENT) ? Document.TYPE_MSXML_FREETHREADED_DOCUMENT : type;
		this.processor = null; // XSLT processor
		this.inclusions = true; // Process inclusions automatically?
		
		this.parse = parseStylesheet; // Parse stylesheet XML
		this.addParameter = addStylesheetParameter; // Add stylesheet parameter
		this.removeParameter = removeStylesheetParameter; // Remove stylesheet parameter
		this.resetParameters = resetStylesheetParameters; // Reset all stylesheet parameters
		
		this.processInclusions = processInclusions; // Force processing inclusions
		this.transform = transformDocument; // Transform document
	}
	
	Stylesheet.STATE_TRANSFORMING = 5;
	Stylesheet.STATE_PROCESSING = 6;
	
	/**
	 * Parse stylesheet XML
	 * 
	 * @this {Stylesheet}
	 * @param {string} source
	 */
	function parseStylesheet(source) {
		
		// Reset stylesheet
		this.includes = [];
		delete this.processor;
		
		var result = parseDocument.call(this, source);
		
		// Run inclusions check and delay complete event
		if (this.inclusions && this.root() === this) {
			this.processInclusions();
			return false;
		}
		
		return result;
	}
	
	/**
	 * Add parameter into stylesheet
	 * 
	 * @this {Stylesheet}
	 * @param {string} name
	 * @param {string} value
	 * @param {string} namespaceURI
	 * @returns {boolean}
	 */
	function addStylesheetParameter(name, value, namespaceURI) {
		namespaceURI = namespaceURI || '';
		
		for (var i = 0, l = this.parameters.length; i < l; i++) {
			if (this.parameters[i].name == name && this.parameters[i].namespaceURI == namespaceURI) {
				this.parameters[i].value = value;
				return true;
			}
		}

		this.parameters.push(new StylesheetParameter(name, value, namespaceURI));
		return true;
	}
	
	/**
	 * Remove parameter from stylesheet
	 * 
	 * @this {Stylesheet}
	 * @param {string} name
	 * @param {string} namespaceURI
	 * @returns {boolean}
	 */
	function removeStylesheetParameter(name, namespaceURI) {
		
	}
	
	/**
	 * Reset parameters in stylesheet
	 * 
	 * @this {Stylesheet}
	 * @returns {boolean}
	 */
	function resetStylesheetParameters() {
		var parameter;
		
		// Reset parameters for processor
		if (this.processor) {
			if (XSLTjs.supports.XSLTPROCESSOR) {
				this.processor.clearParameters();
			} else if (XSLTjs.supports.MSXML_TEMPLATE) {
				for (var i = 0, l = this.parameters.length; i < l; i++) {
					parameter = this.parameters[i];
					this.processor.addParameter(parameter.name, null, parameter.namespaceURI);
				}
			}
		}
		
		this.parameters = [];
		return true;
	}
	
	/**
	 * Process xsl:include/import instructions and document() functions in xsl:param/xsl:variable
	 * 
	 * @this {Stylesheet}
	 * @returns {boolean}
	 */
	function processInclusions() {
		var self = this;
		var root = this.root();
		var stylesheet, node, name, url, include;
		var includes = root.includes;
		var query = /document\('(.+)'\)/g;
		var documentVariableName = 'XSLTjs-external-document-';
		var prefix = XSLTjs.supports.MSXML_DOCUMENT && root.document instanceof ActiveXObject ? 'msxml' : 'exsl';
		
		/**
		 * Processing final check and assembly
		 * 
		 * @returns {boolean}
		 */
		function checkComplete() {
			var completed = 0;
			var nodeset = false;
			
			// Check for all other inclusions and see if their statuses are complete
			for (var i = 0, l = includes.length; i < l; i++) {
				var include = includes[i];
				if (include instanceof Document && include.state == Document.STATE_COMPLETE) {
					completed++;
					
					if (! (include instanceof Stylesheet)) {
						nodeset = true;
					}
				}
			}
			
			// All inclusions are complete, finished here
			if (completed == includes.length) {
				try {
					var extensions = root.document.documentElement.getAttribute('extension-element-prefixes') || '';

					if (nodeset && completed > 0) {
						// Add msxml/exsl extensions for nodeset function
						if (extensions.indexOf(prefix) == -1) {
							root.document.documentElement.setAttribute('extension-element-prefixes', extensions.length > 0 ? exensions + ' ' + prefix : prefix);
							root.document.documentElement.setAttribute('xmlns:' + prefix, XSLTjs.namespaces[prefix]);
						}
												
					  // Reload stylesheet XML to catch up with namespaces
						if (XSLTjs.supports.MSXML_DOCUMENT && root.document instanceof ActiveXObject) {
							root.document.loadXML(root.document.xml);
						} else if (XSLTjs.supports.DOMPARSER && XSLTjs.supports.XMLSERIALIZER) {
							root.document = (new DOMParser()).parseFromString(((new XMLSerializer()).serializeToString(root.document)), "text/xml");
						} 
					}
					
					root.state = Document.STATE_COMPLETE;
					root.dispatchEvent(root.inclusions ? 'complete' : 'included');
				} catch (error) {
					root.state = Document.STATE_ERROR;
					root.dispatchEvent('error', error);
				}
			}
		};
		
		this.state = Stylesheet.STATE_PROCESSING;
		
		try {
			node = this.document.documentElement.firstChild;
			
			while (node) {
				if (node.nodeType == 1 && node.namespaceURI == XSLTjs.namespaces.xsl) {
					name = node.localName || node.baseName;
					
					switch (name) {
						case ('import'): // Stylesheet imports
						case ('include'):
							url = combinePaths(this.url, node.getAttribute('href'));
							
							// Search for duplicate includes
							for (var i = 0, l = includes.length; i < l; i++) {
								include = includes[i];
								
								// Skip duplicate includes
								if (include instanceof Stylesheet && include.url == url) {
									node = node.nextSibling;
									continue;
								}
							}
							
							stylesheet = new Stylesheet();
							stylesheet.parent = this;
							
							// Copy settings from parent stylesheet
							stylesheet.async = this.async;
							stylesheet.cache = this.cache;
							stylesheet.timeout = this.timeout;
							stylesheet.stripWhitespace = this.stripWhitespace;
							stylesheet.relation = name;
							
							includes.push(stylesheet);
							
							// let statements are not available to most browsers yet, and 'with' should be avoided
							stylesheet.addEventListener('complete',(function () {
								var include = node;
								
								return function injectStylesheet(event) {
									var root = this.root();
									
									try {
										root.document.documentElement.appendChild(root.document.createComment('Stylesheet ' + this.relation + ' from ' + this.url));
										
										// remove inclusion element
										include.parentNode.removeChild(include);
										
										// TODO: broken point, need to process loaded substylesheets
										this.processInclusions();
																			 
										this.listeners = {}; // Reset listeners									
										this.state = Document.STATE_COMPLETE;
									} catch (error) {
										
										// Send errors to root node
										root.state = Document.STATE_ERROR;
										root.dispatchEvent('error', error);
									}
									
									checkComplete();
								};
							}()));
							
							stylesheet.addEventListener('error', function stylesheetError(event, error) {
								root.state = Document.STATE_ERROR;
								root.dispatchEvent('error', error);
							});
							
							stylesheet.load(url);
							
							break;
						case ('template'):
							if (this !== root) { // Don't copy root templates
								root.document.documentElement.appendChild('importNode' in root.document ? root.document.importNode(node, true) : node);
							}
							
							break;
						case ('param'):
						case ('variable'):
							
							// TODO: Merge params from multiple stylesheets
							
							if (typeof node.hasAttribute == 'function' && ! node.hasAttribute('select')) {
								break;
							}
						
							var importedParameter;
						
							if (this !== root) {
								importedParameter = 'importNode' in root.document ? root.document.importNode(node, true) : node;
								root.document.documentElement.insertBefore(importedParameter, root.document.documentElement.firstChild);
							} else {
								importedParameter = node;
							}
						
							// Look for document calls in select
							importedParameter.setAttribute('select', node.getAttribute('select').replace(query, function parseDocumentFunction(string, url) {
								var document, id = undefined;
								url = combinePaths(self.url, url);
								
								// Find document with same url
								for (var i = 0, l = includes.length; i < l; i++) {
									include = includes[i];
									
									if (include instanceof Document && include.url == url) {
										documentID = i;
									}
								}
								
								// If not create new document
								if (typeof id == 'undefined') {
									document = new Document();
									document.parent = self;
									
									// Copy settings from stylesheets
									document.async = self.async;
									document.async = self.async;
									document.cache = self.cache;
									document.type = self.type;
									document.timeout = self.timeout;
									document.stripWhitespace = self.stripWhitespace;
									
									id = includes.push(document);
									
									document.addEventListener('complete', (function () {
										var param = node, documentID = id;
										
										return function injectDocument(event) {
											var root = this.root();
											var variable;
											var comment;
											
											try {
												// Set up special variable to hold nodeset of the document
												variable = 'createElementNS' in root.document ? root.document.createElementNS(XSLTjs.namespaces.xsl, 'xsl:variable') : root.document.createNode(1, 'xsl:variable', XSLTjs.namespaces.xsl);
												variable.setAttribute('name', documentVariableName + documentID);
												variable.appendChild('importNode' in root.document ? root.document.importNode(this.document.documentElement, true) : this.document.documentElement);
												
												comment = root.document.createComment('Document from ' + this.url)
												
												// Add variable into root document
												root.document.documentElement.insertBefore(comment, root.document.documentElement.firstChild);
												root.document.documentElement.insertBefore(variable, comment.nextSibling);
												
											} catch (error) {
												root.state = Document.STATE_ERROR;
												root.dispatchEvent('error', error);
											}
											
											checkComplete();
										}; 
									}()));
									
									document.addEventListener('error', function documentError(event, error) {
										root.state = Document.STATE_ERROR;
										root.dispatchEvent('error', error);
									});
									
									document.load(url);
								}
								
								return (prefix + ':node-set($' + documentVariableName + id + ')');
							}));
							
							break;
					}
				}
				
				node = node.nextSibling;
			}
		} catch(error) {
			this.dispatchEvent('error', error);
		}
		
		checkComplete();
		return true;
	}
		
	/**
	 * Transform input document
	 * 
	 * @this {Stylesheet}
	 * @param {Document} document
	 * @param {Document} result
	 * @returns {Document}
	 */
	function transformDocument(document, result) {
		var template;
		
		if (typeof this.document != 'object') {
			throw new Error('Stylesheet is empty');
		}
		
		if (! (document instanceof Document)) {
			throw new Error('Invalid document object');
		}
		
		if (typeof document.document != 'object') {
			throw new Error('Document is empty');
		}

		try {
			// Initialize processor
			if (! this.processor) {
				if (XSLTjs.supports.XSLTPROCESSOR) {
					this.processor = new XSLTProcessor();
					this.processor.importStylesheet(this.document);
				} else if (XSLTjs.supports.MSXML_TEMPLATE) {
					var template = new ActiveXObject('Msxml2.XSLTemplate');
					template.stylesheet = this.document;
					this.processor = template.createProcessor();
				} else if (XSLTjs.supports.MSXML_TRANSFORMNODE) {
					this.processor = null;
				}
			}
			
			// Create transformation result document
			if (! (result instanceof Document)) {
				result = new Document();
			}
			
			result.url = document.url;
			this.state = Stylesheet.STATE_TRANSFORMING;
			
			// Set stylesheet parameters
			for (var i = 0, l = this.parameters.length; i < l; i++) {
				parameter = parameters[i];
				
				if (! (parameter instanceof StylesheetParameter)) {
					continue;
				}
				
				if (XSLTjs.supports.XSLTPROCESSOR && this.processor instanceof XSLTProcessor) {
					this.processor.setParameter(parameter.namespaceURI, parameter.name, parameter.value);
				} else if (XSLTjs.supports.MSXML_TEMPLATE && this.processor instanceof ActiveXObject) {
					this.processor.addParameter(parameter.name, parameter.value, parameter.namespaceURI);
				} else if (XSLTjs.supports.MSXML_TRANSFORMNODE && this.processor == null) {
					// TODO: parameters for transformNode
				}
			}
			
			this.dispatchEvent('preprocessed', result);
			
			// Process document
			if (XSLTjs.supports.XSLTPROCESSOR && this.processor instanceof XSLTProcessor) {
				result.document = this.processor.transformToDocument(document.document);
			} else if (this.processor) {
				this.processor.input = document.document;
				
				if (this.processor.transform()) {
					result.parse(this.processor.output);
				}
			} else {
				result.parse(document.transformNode(this.document));
			}
			
			this.state = result.state = Document.STATE_COMPLETE;
			this.dispatchEvent('transformed', result);
			return result;
		} catch (error) {
			this.state = Document.STATE_ERROR;
			this.dispatchEvent('error', error);
		}
		
		return false;
	}

	/**
	 * 
	 * @constructor
	 * @returns {ServerStylesheet}
	 */
	function ServerStylesheet() {
		this.listeners = {};
		this.headers = {};
		
		this.load = loadServer;
		this.transform = transformServer;
	}
	
	function loadServer(url) {
		// TODO: Missing functionality
	}
	
	function transformServer(url) {
		// TODO: Missing functionality
	}
	
	var XSLTjs = {
		namespaces: { // Namespace dictionary
			xml: "http://www.w3.org/XML/1998/namespace",
			xhtml: "http://www.w3.org/1999/xhtml",
			xsl: "http://www.w3.org/1999/XSL/Transform",
			xsi: "http://www.w3.org/2001/XMLSchema-instance",
			exsl: "http://exslt.org/common",
			msxml: "urn:schemas-microsoft-com:xslt",
			xsltjs: "http://www.xsltjs.com"
		},
		supports: {
			XMLHTTPREQUEST: browser.test(function testXMLHttpRequest() {
				new XMLHttpRequest();
			}),
			XDOMAINREQUEST: browser.test(function testXDomainRequest() {
				new XDomainRequest();
			}),
			XMLDOCUMENT: browser.test(function testXMLDocument() {
				if (! (document.implementation && typeof document.implementation.createDocument == 'function')) {
					throw new Error('Document implementation createDocument not defined');
				}
			}),
			DOMPARSER: browser.test(function testDOMParser() {
				new DOMParser();
			}),
			XMLSERIALIZER: browser.test(function testXMLSerializer() {
				new XMLSerializer();
			}),
			XSLTPROCESSOR: browser.test(function testXSLTProcessor() {
				new XSLTProcessor();
			}),
			MSXML_DOCUMENT: browser.test(function testMSXML_Document() {
				new ActiveXObject('Msxml2.DOMDocument');
			}),
			MSXML_FREETHREADED_DOCUMENT: browser.test(function testMSXML_FreeThreadedDocument() {
				new ActiveXObject('Msxml2.FreeThreadedDOMDocument');
			}),
			MSXML_TEMPLATE: browser.test(function testMSXML_Template() {
				new ActiveXObject('Msxml2.XSLTemplate');
			}),
			MSXML_TRANSFORMNODE: browser.test(function testMSXML_TransformNode() {
				var msxml = new ActiveXObject('Msxml2.DOMDocument');
				
				if (typeof msxml.transformNode != 'unknown' || typeof msxml.transformNodeToObject != 'unknown') {
					throw new Error('Transform node methods are not defined in MSXML document');
				}
			})
		},
		Document: Document,
		Stylesheet: Stylesheet,
		ServerStylesheet: ServerStylesheet
	};
	
	Document.prototype = new EventCollection();
	Stylesheet.prototype = new Document();
	ServerStylesheet = new Stylesheet();
	
	if (typeof browser.cache == 'undefined') {
		browser.save('supports');
	}
	
	if (typeof window[prefix] == 'undefined') {
		window[prefix] = XSLTjs;
	}
}('XSLTjs'));