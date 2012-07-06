XSLTjs
======

Small JavaScript library for cross-browser XSLT processing. Supports modern browsers at desktops and mobile alike with native XSLT processor.

Browsers support
----------------

* Internet Explorer (MSXML)
* Mozilla Firefox (Transformiix)
* Google Chrome/Apple Safari (libxslt)
* Opera (Presto)

Example
-------

	var xml = new XSLTjs.Document();
	var xsl = new XSLTjs.Stylesheet();
	
	function completeHandler(event) {
		if (xml.isReady() && xsl.isReady()) {
			xsl.transform(xml).insert(document.getElementById('result'));
		}
	};
	
	xml.addEventListener('complete', completeHandler);
	xsl.addEventListener('complete', completeHandler);
	
	xml.load('data.xml');
	xsl.load('view.xsl');