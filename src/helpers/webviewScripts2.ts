import { WebViewMessageEvent } from "react-native-webview";
import { Linking } from "react-native";

// ATTENTION: any embedded JavaScript code must be compatible with old
// JavaScript implementations. This code doesn't go through webpack, so it's not
// dumbed down to a more compatible code equivalent.

export const onError = `
  (function() {
    function get(object, chain) {
      var value = object;
      var paths = chain.split(".");

      while (paths.length) {
        var path = paths.shift();
        value = value && value[path];
      }

      return value;
    }

    window.addEventListener("error", function(event) {
      window.postMessage(
        JSON.stringify({
          type: "error",
          context: {
            message: event.message,
            sourcefile: event.sourcefile,
            lineno: event.lineno,
            colno: event.colno,
            error: {
              message: get(event, "error.message"),
              constructor: get(event, "error.constructor.name"),
              stack: get(event, "error.stack")
            }
          }
        }),
        window.location.origin,
      );
    });
  })();
`;

export const postMessage = `
  (function() {
    function newPostMessage(data) {
      return window.ReactNativeWebView.postMessage(
        typeof data === "string" ? data : JSON.stringify(data)
      );
    }

    window.postMessage = newPostMessage;
    window.parent = window.parent || {};
    window.parent.postMessage = newPostMessage;
    window.opener = window.opener || {};
    window.opener.postMessage = newPostMessage;
  })();
`;

export const blankTarget = `
  (function() {
    var attachEvent = function(elem, event, callback) {
      event = event.replace(/^on/g, "");
      if ("addEventListener" in window) {
        elem.addEventListener(event, callback, false);
      } else if ("attachEvent" in window) {
        elem.attachEvent("on" + event, callback);
      } else {
        var registered = elem["on" + event];
        elem["on" + event] = registered
          ? function(e) {
              registered(e);
              callback(e);
            }
          : callback;
      }

      return elem;
    };
    var all_links = document.querySelectorAll("a[target=_blank]");
    if (all_links) {
      for (var i in all_links) {
        if (all_links.hasOwnProperty(i)) {
          attachEvent(all_links[i], "onclick", function(e) {
            if (!new RegExp("^https?:" + location.host, "gi").test(this.href)) {
              // handle external URL
              e.preventDefault();
              window.postMessage(
                JSON.stringify({
                  externalUrlOpen: this.href,
                }),
              );
            }
          });
        }
      }
    }
  })();
`;

export const handleClickOnArticle = `
  (function() {
    // Every 500ms we check to see if there's a new article link
    // to override the default behavior of the onclick function.
    // Additionally it only do something if the chat is open.
    setInterval(function() {
      const chatIframe = document.querySelector("html > body > div:last-of-type > div:first-of-type > iframe");
      if (chatIframe && "contentWindow" in chatIframe) {
        const articleButtons = chatIframe.contentWindow.document.querySelectorAll("a[type=button]");
        articleButtons
          .forEach(article => {
            article.onclick = function(event) {
              event.preventDefault();

              const closeChatButton = chatIframe.contentWindow.document.querySelector("html > body > div > div > div[role=presentation] > div[role=presentation] > section > div:last-of-type > button");
              if (closeChatButton) {
                closeChatButton.click();
              }

              window.location = article.href;
            };
          });
      }
    }, 500);
  })();
`;

export function handleBlankTargetEvent(event: WebViewMessageEvent) {
  let result: {
    externalUrlOpen?: string;
  } = {
    externalUrlOpen: "",
  };

  if (typeof event.nativeEvent.data === "string") {
    try {
      result = JSON.parse(event.nativeEvent.data);
    } catch (err) {
      // do nothing
    }
  }

  if (result.externalUrlOpen) {
    console.log("> > > > > > externalUrlOpen", result.externalUrlOpen);
    Linking.openURL(result.externalUrlOpen);
  }
}
