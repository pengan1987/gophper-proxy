function GopherParser() {};

// regex for matching gopher entries. it didn't quite work in it's original form (see below)
GopherParser.prototype.entryPattern = /^(.)(.*?)\t(.*?)\t(.*?)\t(\d+).*/;
GopherParser.prototype.entryTypes = {
	info: { style: 'info', link : false },
	error: { style: 'error', link : false },
	directory: { style: 'info', link : true },
	document: { style: 'document', link : true },
	binhex: { style: 'file', link : true },
	dosbinary: { style: 'file', link : true },
	uuencoded: { style: 'file', link : true },
	binary: { style: 'file', link : true },
	html: { style: 'html', link : true },
	search: { style: 'search', link : true, form: true },
	image: { style: 'image', link : true },
	audio: { style: 'audio', link : true },
	unknown: { style: 'unknown', link : true }
};


GopherParser.prototype.shouldRender = function(d) {
	var data = d.split("\n");
	return data[0].match(this.entryPattern) !== null;
};
GopherParser.prototype.isBinary = function(d) {
	return /[\x00-\x1F]/.test(d);
};

GopherParser.prototype.parseGopher = function(data) {
	var lines = [];
	data = data.split("\n");
	for ( var i = 0; i < data.length; i++ ) {
		if ( data[i] != "." ) {
			lines.push(this.parseEntry(data[i]));
		}
	}

	return lines;
};

/**
 * borrowed from phpjs:
 * @see http://phpjs.org/functions/gopher_parsedir:833
 */
GopherParser.prototype.parseEntry = function(dirent) {
	//var entryPattern = /^(.)(.*?)\t(.*?)\t(.*?)\t(.*?)\u000d\u000a$/;
	// http://kevin.vanzonneveld.net
	// +   original by: Brett Zamir (http://brett-zamir.me)
	// *     example 1: var entry = gopher_parsedir('0All about my gopher site.\t/allabout.txt\tgopher.example.com\t70\u000d\u000a');
	// *     example 1: entry.title;
	// *     returns 1: 'All about my gopher site.'

	/* Types
	 * 0 = plain text file
	 * 1 = directory menu listing
	 * 2 = CSO search query
	 * 3 = error message
	 * 4 = BinHex encoded text file
	 * 5 = binary archive file
	 * 6 = UUEncoded text file
	 * 7 = search engine query
	 * 8 = telnet session pointer
	 * 9 = binary file
	 * g = Graphics file format, primarily a GIF file
	 * h = HTML file
	 * i = informational message
	 * s = Audio file format, primarily a WAV file
	 */

	var entry = dirent.match(this.entryPattern);
	if (entry === null) {
		return {};
	}

	var type;
	switch (entry[1]) {
	case 'i':
		type = this.entryTypes.info;
		break;
	case '3':
		type = this.entryTypes.error;
		break;
	case '1':
		type = this.entryTypes.directory;
		break;
	case '0':
		type = this.entryTypes.document;
		break;
	case '4':
		type = this.entryTypes.binhex;
		break;
	case '5':
		type = this.entryTypes.dosbinary;
		break;
	case '6':
		type = this.entryTypes.uuencoded;
		break;
	case '7':
		type = this.entryTypes.search;
		break;
	case '9':
		type = this.entryTypes.binary;
		break;
	case 'h':
		type = this.entryTypes.html;
		break;
	case 'd':
		type = this.entryTypes.image;
		break;
	case 's':
		type = this.entryTypes.audio;
		break;
	default:
		type = this.entryTypes.unknown;
	}

	return {
		type: type,
		title: entry[2],
		path: entry[3],
		host: entry[4],
		port: entry[5]
	};

};

(function( $ ){

	/**
	 * convert newlines to breaks
	 */
	function nl2br (str, is_xhtml) {
		// http://kevin.vanzonneveld.net
		// +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
		// +   improved by: Philip Peterson
		// +   improved by: Onno Marsman
		// +   improved by: Atli Þór
		// +   bugfixed by: Onno Marsman
		// +      input by: Brett Zamir (http://brett-zamir.me)
		// +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
		// +   improved by: Brett Zamir (http://brett-zamir.me)
		// +   improved by: Maximusya
		// *     example 1: nl2br('Kevin\nvan\nZonneveld');
		// *     returns 1: 'Kevin<br />\nvan<br />\nZonneveld'
		// *     example 2: nl2br("\nOne\nTwo\n\nThree\n", false);
		// *     returns 2: '<br>\nOne<br>\nTwo<br>\n<br>\nThree<br>\n'
		// *     example 3: nl2br("\nOne\nTwo\n\nThree\n", true);
		// *     returns 3: '<br />\nOne<br />\nTwo<br />\n<br />\nThree<br />\n'
		var breakTag = (is_xhtml || typeof is_xhtml === 'undefined') ? '<br />' : '<br>';

		return (str + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + breakTag + '$2');
	}

	/**
	 * parse some gophertext and render some pretty HTML from it.
	 *
	 * d - data to parse. if this isn't specified, parse the contents of the target element
	 */
	$.fn.fromGopher = function(d) {
		var data, entries;
		var parser = new GopherParser();

		if ( typeof(d) === "undefined" ) {
			data = $(this).html().trim();
		}
		else {
			data = d;
		}

		// make sure we should render -- if this doesn't look like gophertext,
		// we'll just spit back the text itself
		if ( ! parser.shouldRender(data) ) {
			$(this).html(nl2br(data));
		}
		else {
			entries = parser.parseGopher(data);

			// reset the container
			$(this).html("");

			for ( var i = 0; i < entries.length; i++ ) {
				var e = entries[i];

				if ( e.path[0] != "/" ) {
					e.path = "/" + e.path;
				}

				var href = "/" + e.host + e.path;
				var text = e.title;
				var type = e.type;
				var result;

				if ( type.form == true ) {

					// handle search input

					result = $("<form method='post' />").
						attr("action", href).
						addClass("gopher-" + type.style).
						addClass("form-inline");

					$(result).append("<input name='text' class='span3' placeholder='input' />");
					var button = $("<button />").attr("type", "submit").addClass("btn").html("Go!");
					$(result).append(button).append("<span class='spinny' />");

				}
				else if ( type.link == false || !e.path || e.path == "" ) {

					// if there was no path, don't output a URL

					result = text;
				}
				else {
					result = $("<a />").
						attr("href", href).
						addClass("gopher-" + type.style).
						html(text).after("<span class='spinny' />");
				}

				$(this).append(result).append("<br />");
			}
		}
		return $(this);
	};
})( jQuery );
