/*globals ril, webkitNotifications */

$(function () {
  var VERSION = "1.1.1";

  var usePageAction = false,
      authentication;


  // Utility functions
  function isValidURL(s) {
    return (/^https?\:/i).test(s);
  }

  // Notification functions
  function showNotification(tabId, title) {
    showNotificationWithStatus(tabId, title, "normal");
  }

  function showNotificationWithStatus(tabId, title, status) {
    var showNotifications = localStorage.notifications,
        notificationURL = chrome.extension.getURL('html/notification.html');

    notificationURL += '?' + 'title=' + encodeURIComponent(title);
    notificationURL += '&' + 'status=' + status;

    if (!showNotifications || showNotifications === "true") {
//      webkitNotifications.createHTMLNotification(notificationURL).show();
    }
  }

  function showInvalidURLNotification(tabId) {
    showNotification(tabId, "Sorry, you can only save valid web pages to Pocket.");
  }

  function showErrorNotification(tabId, message) {
    showNotificationWithStatus(tabId, (message || "Sorry, we can't save this item right now."), "error");
  }

  function showSaveNotification(tabId, title) {
    showNotification(tabId, 'Saved: "' + title.substring(0, 40) + '..."');
  }

  function loadNotificationUIIntoPage(tabId, url){
    tabId = tabId || null;
    if(localStorage.notifications){
      if(url){
        chrome.tabs.executeScript(tabId, {code: "window.___PKT__URL_TO_SAVE = '" + url + "'"});      
      }
      chrome.tabs.executeScript(tabId, {file: "js/r.js"});      
    }
  };

  // Context menu
  (function setupContextMenu() {
    function handler(info, tab) {
      // Create login window if the user is not logged in
      if (!ril.isAuthorized()) {
        return authentication.showLoginWindow();
      }

      var url = info.linkUrl,
          title = info.selectionText || url;
          
      if (!url) {
        url = tab.url;
        title = tab.title;
      }

      if (!isValidURL(url)) {
        showInvalidURLNotification();
        return;
      }

      var tabId = tab && tab.id ? tab.id : null;
      loadNotificationUIIntoPage(tabId, url);
      ril.add(title, url, {
        success: function () {
          chrome.tabs.sendRequest(tabId, {status: "success"});
          showSaveNotification(tab.id, title);
        },
        error: function (status, xhr) {
          if (status === 401) {
            chrome.tabs.sendRequest(tabId, {status: "unauthorized"});
            return authentication.showLoginWindow();
          }
          chrome.tabs.sendRequest(tabId, {status: "error", error: xhr.getResponseHeader("X-Error")});
          showErrorNotification(tab.id, xhr.getResponseHeader("X-Error"));
        }
      });
    }

    // Add a context menu entry for links to add it to the queue
    chrome.contextMenus.create({
      "title": "Save to Pocket",
      "contexts": ["page", "frame", "editable", "image", "video", "audio", "link", "selection"],
      "onclick": handler
    });
  }());

  // Authentication
  authentication = (function authentication() {
    function showLoginWindow() {
      var width = 427,
          height = 384;

      chrome.windows.create({
        'url': '../html/login.html',
        'type': 'popup',
        'width': width,
        'height': height,
        'left': (screen.width / 2) - ((width+1) / 2),
        'top': (screen.height / 2) - (height / 2)
      }, function () {});
    }

    chrome.extension.onRequest.addListener(function (request, sender, sendResponse) {
      if (request.action === "login") {
        ril.login(request.username, request.password, {
          success: function () {
            // dissappear popup
            chrome.tabs.update(request.tabId, {
              selected: true
            });

            // remove login popup for all tabs
            chrome.tabs.query({}, function (tabs) {
              $.each(tabs, function (index, tab) {
                if (usePageAction) {
                  chrome.pageAction.setPopup({
                    tabId: tab.id,
                    popup: ''
                  });
                } else {
                  chrome.browserAction.setPopup({
                    tabId: tab.id,
                    popup: ''
                  });
                }
              });
            });

            chrome.extension.sendRequest({
              action: "updateOptions"
            });
            sendResponse({
              status: "success"
            });
          },
          error: function (xhr) {
            sendResponse({
              status: "error",
              error: xhr.getResponseHeader("X-Error")
            });
          }
        });
      } else if (request.action === "logout") {
        ril.logout();

        // set login popup for all tabs
        chrome.tabs.query({}, function (tabs) {
          $.each(tabs, function (index, tab) {
            if (usePageAction) {
              chrome.pageAction.setPopup({
                tabId: tab.id,
                popup: '../html/login.html'
              });
            } else {
              chrome.browserAction.setPopup({
                tabId: tab.id,
                popup: "../html/login.html"
              });
            }
          });
        });
        sendResponse({});
      } else if (request.action === "showLoginWindow") {
        showLoginWindow();
        sendResponse({});
      } else if (request.action === "keyboardShortcutEnabled") {
        sendResponse({keyboardShortcutEnabled: (localStorage["keyboard-shortcut"] === "true" ? true : false)});
      }
    });

    return {
      showLoginWindow: showLoginWindow
    };
  }());

  // Listener for fetching options & adding URLs
  chrome.extension.onRequest.addListener(function (request, sender, sendResponse) {
    if (request.action === "localStorage") {
      sendResponse({
        "value": localStorage[request.key]
      });
    } else if (request.action === "addURL") {
      var tabId = (sender && sender.tab && sender.tab.id ? sender.tab.id : null);

      // Create login window if the user is not logged in
      if (!ril.isAuthorized()) {
        return authentication.showLoginWindow();
      }

      loadNotificationUIIntoPage(tabId, request.url);
      ril.add(request.title, request.url, {
        ref_id: request.ref_id,
        success: function () {
          chrome.tabs.sendRequest(tabId, {status: "success"});
          showSaveNotification(sender.tab.id, request.title);
          sendResponse({
            status: "success"
          });
        },
        error: function (status, xhr) {
          if (status === 401) {
            chrome.tabs.sendRequest(tabId, {status: "unauthorized"});
            return authentication.showLoginWindow();
          }
          chrome.tabs.sendRequest(tabId, {status: "error", error: xhr.getResponseHeader("X-Error")});
          showErrorNotification(sender.tab.id, xhr.getResponseHeader("X-Error"));
          sendResponse({
            status: "error"
          });
        }
      });
    }else if(request.action == "addTags"){
      var tabId = (sender && sender.tab && sender.tab.id ? sender.tab.id : null);

      // Create login window if the user is not logged in
      if (!ril.isAuthorized()) {
        return authentication.showLoginWindow();
      }

      loadNotificationUIIntoPage(tabId, request.url);

      var url = request.url;
      var tags = request.tags;
      var action = {
        action: "tags_add",
        tags: tags,
        url: url
      };

      ril.sendAction(action, {
        success: function () {
          sendResponse({
            status: "success"
          });
        },
        error: function (status, xhr) {
          if (status === 401) {
            return authentication.showLoginWindow();
          }
          sendResponse({
            status: "error",
            error: xhr.getResponseHeader("X-Error")
          });
        }
      });
    }
  });

  // Listen for clicks on the page action
  chrome.pageAction.onClicked.addListener(function (tab) {
    var tabId = tab.id,
        title = tab.title,
        url = tab.url;

    // check if URL is valid
    if (!isValidURL(url)) {
      showInvalidURLNotification();
      return;
    }

    loadNotificationUIIntoPage(tabId, url);

    chrome.pageAction.setIcon({
      tabId: tabId,
      path: "../img/page-action-icon-added.png"
    });
    ril.add(title, tab.url, {
      success: function () {
        chrome.tabs.sendRequest(tabId, {status: "success"});
        showSaveNotification(tabId, title);
      },
      error: function (status) {
        if (status === 401) {
          chrome.tabs.sendRequest(tabId, {status: "unauthorized"});
          return authentication.showLoginWindow();
        }
        chrome.tabs.sendRequest(tabId, {status: "error", error: xhr.getResponseHeader("X-Error")});
        chrome.pageAction.setIcon({
          tabId: tabId,
          path: "../img/page-action-icon.png"
        });
        showErrorNotification(tabId, xhr.getResponseHeader("X-Error"));
      }
    });
  });


  // Listen for clicks on the page action icon
  chrome.browserAction.onClicked.addListener(function (tab) {
    var tabId = tab.id || null,
        title = tab.title,
        url = tab.url;

    // check if URL is valid
    if (!isValidURL(url)) {
      showInvalidURLNotification();
      return;
    }

    loadNotificationUIIntoPage();

    ril.add(title, tab.url, {
      success: function () {
        chrome.tabs.sendRequest(tabId, {status: "success"});
        showSaveNotification(tabId, title);
      },
      error: function (status, xhr) {
        console.log('status', status);
        if (status === 401) {
          chrome.tabs.sendRequest(tabId, {status: "unauthorized"});
          return authentication.showLoginWindow();
        }
        chrome.tabs.sendRequest(tabId, {status: "error", error: xhr.getResponseHeader("X-Error")});
        showErrorNotification(tabId, xhr.getResponseHeader("X-Error"));
      }
    });
  });

  // Called when the url of a tab changes.
  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (usePageAction) {
      chrome.pageAction.show(tabId);
    }
    if (!ril.isAuthorized()) {
      if (usePageAction) {
        chrome.pageAction.setPopup({
          tabId: tabId,
          popup: "../html/login.html"
        });
      } else {
        chrome.browserAction.setPopup({
          tabId: tabId,
          popup: "../html/login.html"
        });
      }
    }
  });

  // Initialization code
  (function initialize() {
    // Set the default options
    $.each({
      twitter: "true",
      greader: "true",
      notifications: "true",
      "keyboard-shortcut": "true"
    }, function (key, value) {
      if (!localStorage[key]) {
        localStorage[key] = value;
      }
    });

    // Check for first time installation
    if (!localStorage.installed || localStorage.installed !== "true") {
      localStorage.installed = "true";
      chrome.tabs.create({
        url: "http://getpocket.com/installed/"
      });
    }

    // Check for upgrade from 1.0
    else if (localStorage.installed === "true" && (!localStorage.lastInstalledVersion || localStorage.lastInstalledVersion != VERSION)) {
      chrome.tabs.create({
        url: "http://getpocket.com/chrome/updated?v="+VERSION
      });
    }

    localStorage.lastInstalledVersion = VERSION;
  }());
});
