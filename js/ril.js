var ril = (function () {
  var baseURL = "http://readitlaterlist.com/v3",
      apiKey = "801p7PR9A5b78x11f4ghRD8CVFdrA689",
      cookieAuthAttempted = false;
      
  function isAuthorized() {
    return (localStorage.token && localStorage.username);
  }

  function logout() {
    // Clean up the localStorage
    localStorage.removeItem('username');
    localStorage.removeItem('token');
  }

  /* Attempt to get a token from the API by looking at what cookies the client
   * is sending. Callbacks is an optional hash with "success" and "failure".
   */
  function attemptToGetExistingToken(callbacks) {
    callbacks = callbacks || {};

    if (cookieAuthAttempted === false) {
      $.ajax({
        url: baseURL + "/token?apikey=" + apiKey,
        success: function (data) {
          cookieAuthAttempted = 1;
          localStorage.username = data.username;
          localStorage.token = data.token;
          if (callbacks.success()) {
            callbacks.success();
          }
        },
        error: function () {
          cookieAuthAttempted = 2;
          if (callbacks.failure()) {
            callbacks.failure();
          }
        }
      });
    } else if (cookieAuthAttempted === 1) {
      if (callbacks.success()) {
        callbacks.success();
      }
    } else if (cookieAuthAttempted === 2) {
      if (callbacks.failure()) {
        callbacks.failure();
      }
    }
  }

  function login(user, pass, callbacks) {
    var authURL = baseURL + "/auth?getToken=1";
    authURL += "&username=" + encodeURIComponent(user) + "&password=" + encodeURIComponent(pass);
    authURL += "&apikey=" + apiKey;

    $.ajax({
      url: authURL,
      success: function (data) {
        // Save login information
        localStorage.username = user;
        localStorage.token = data.token;
        callbacks.success();
      },
      error: callbacks.error
    });
  }

  function add(title, url, options) {
    var action = {
      action: "add",
      url: url,
      title: title
    };
    this.sendAction(action, options);
  }

  function sendAction(action, options){
    var sendURL = baseURL + "/send?" + "token=" + localStorage.token + "&apikey=" + apiKey + "&actions=";

    if (options.ref_id) {
      action.ref_id = options.ref_id;
    }

    $.ajax({
      url: sendURL + encodeURIComponent(JSON.stringify([action])),
      success: function () {
        options.success();
      },
      error: function (xhr) {
        if (xhr.status === 401) {
          logout();
        }
        options.error(xhr.status, xhr);
      }
    });
  }

  if (!isAuthorized()) {
    attemptToGetExistingToken({
      success: function () {
        console.log('Authorized via cookie.');
      },
      failure: function () {
        console.log('Could not authorize.');
      }
    });
  } else {
    console.log('Already authorized.');
  }

  return {
    isAuthorized: isAuthorized,
    attemptToGetExistingToken: attemptToGetExistingToken,
    login: login,
    logout: logout,
    add: add,
    sendAction: sendAction
  };
}());