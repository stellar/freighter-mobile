import {
  DAPP_APPROVAL_TIMEOUT_MS,
  WEBVIEW_BRIDGE_MAX_ENVELOPE_BYTES,
} from "config/constants";

/** Wire protocol name shared by the bootstrap and the native controller. */
export const WEBVIEW_BRIDGE_PROTOCOL = "freighter-webview";
/** Bump when the envelope shape changes; the controller rejects other versions with UNSUPPORTED_VERSION. */
export const WEBVIEW_BRIDGE_PROTOCOL_VERSION = 1;

/**
 * Script injected before content loads into every Discovery document. It
 * installs `window.stellar` with promise-based `request/on/off`, correlates
 * requests by id, and announces readiness. It never installs into an iframe
 * and stays inert until the native controller activates the document with a
 * token; authorization always happens natively.
 */
export const bridgeBootstrap = (appVersion: string): string => `
(function () {
  if (window.top !== window || window.__freighterActivate) return;
  var pending = new Map(), listeners = new Map(), nextId = 0, token = '';
  var protocol = ${JSON.stringify(WEBVIEW_BRIDGE_PROTOCOL)};
  var bridge = { provider: 'freighter', platform: 'mobile', version: ${JSON.stringify(appVersion)},
    request: function (input) {
      return new Promise(function (resolve, reject) {
        if (!token) return reject({code:'UNAVAILABLE',message:'Wallet bridge unavailable'});
        var id = String(++nextId);
        var envelope = {protocol:protocol,version:1,id:id,documentToken:token,method:input.method,params:input.params || {}};
        var json = JSON.stringify(envelope);
        if (new TextEncoder().encode(json).length > ${WEBVIEW_BRIDGE_MAX_ENVELOPE_BYTES}) return reject({code:'INVALID_PARAMS',message:'Request too large'});
        var timeout = setTimeout(function () {
          pending.delete(id);
          reject({code:'TIMEOUT',message:'Request timed out; submission outcome may be unknown'});
        }, ${DAPP_APPROVAL_TIMEOUT_MS});
        pending.set(id, {resolve:resolve,reject:reject,timeout:timeout});
        try { window.ReactNativeWebView.postMessage(json); }
        catch (e) { clearTimeout(timeout); pending.delete(id); reject({code:'UNAVAILABLE',message:'Wallet bridge unavailable'}); }
      });
    },
    on: function (event, listener) { if (!listeners.has(event)) listeners.set(event,new Set()); listeners.get(event).add(listener); },
    off: function (event, listener) { if (listeners.has(event)) listeners.get(event).delete(listener); }
  };
  window.stellar = bridge;
  var ready = function () {
    try { window.ReactNativeWebView.postMessage(JSON.stringify({protocol:protocol,version:1,ready:true})); } catch (e) {}
  };
  ready();
  if (typeof document !== 'undefined' && document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  window.__freighterReceive = function (message) {
    if (message.protocol !== protocol || message.version !== 1 || message.documentToken !== token) return;
    if (message.event) {
      if (message.event === 'disconnect') {
        pending.forEach(function(p) {clearTimeout(p.timeout);p.reject(message.data);});pending.clear();
      }
      if (listeners.has(message.event)) listeners.get(message.event).forEach(function(fn){try{fn(message.data);}catch(e){}});
      return;
    }
    var p = pending.get(message.id); if (!p) return;
    clearTimeout(p.timeout); pending.delete(message.id);
    if (message.error) p.reject(message.error); else p.resolve(message.result);
  };
  window.__freighterActivate = function (newToken) {
    if (token && token !== newToken) {
      pending.forEach(function(p){clearTimeout(p.timeout);p.reject({code:'CONTEXT_CHANGED',message:'Document changed'});});pending.clear();
    }
    token = newToken; bridge.documentToken = token; bridge.protocolVersion = 1;
  };
})(); true;
`;

/**
 * Script that (re)installs the bootstrap and activates the document at
 * `origin` with `token`. The origin guard keeps a late injection from
 * activating a document that navigated meanwhile.
 */
export const activateBridge = (
  version: string,
  token: string,
  origin: string,
) =>
  `${bridgeBootstrap(version)}\nif (location.origin === ${JSON.stringify(origin)}) window.__freighterActivate(${JSON.stringify(token)}); true;`;

/**
 * Script that delivers one response or event to the page, guarded so a
 * replacement document (new origin or token) never receives it.
 */
export const bridgeDelivery = (token: string, origin: string, data: unknown) =>
  `if (location.origin === ${JSON.stringify(origin)} && window.stellar && window.stellar.documentToken === ${JSON.stringify(token)}) window.__freighterReceive(${JSON.stringify(data)}); true;`;
