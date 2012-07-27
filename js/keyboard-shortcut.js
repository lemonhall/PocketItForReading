document.onkeydown = function(e) {
	e = e || window.event;
	var k = e.which || e.charCode || e.keyCode;

	if(((e.ctrlKey && !e.metaKey) || (!e.ctrlKey && e.metaKey)) && !e.altKey && e.shiftKey && k == 	80){
		chrome.extension.sendRequest({action: "keyboardShortcutEnabled"}, function(response){
			if(response.keyboardShortcutEnabled){
				chrome.extension.sendRequest({action: "addURL", title: document.title, url: window.location.toString()})
			}
		})
		return false;
	}

	return true;
}