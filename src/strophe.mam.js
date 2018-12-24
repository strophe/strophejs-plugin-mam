/* XEP-0313: Message Archive Management
 * Copyright (C) 2012 Kim Alvefur
 * Copyright (C) 2018 Emmanuel Gil Peyrot
 *
 * This file is MIT/X11 licensed. Please see the
 * LICENSE.txt file in the source package for more information.
 *
 * Modified by: Chris Tunbridge (github.com/Destreyf/)
 * Updated to support v0.3 of the XMPP XEP-0313 standard
 * http://xmpp.org/extensions/xep-0313.html
 *
 */
import { $iq, Strophe } from 'strophe.js';

Strophe.addConnectionPlugin('mam', {
    _c: null,
    _p: [ 'with', 'start', 'end' ],
    init: function (conn) {
        this._c = conn;
        Strophe.addNamespace('MAM', 'urn:xmpp:mam:2');
        Strophe.addNamespace('Forward', 'urn:xmpp:forward:0');
    },
    query: function (jid, options) {
        var _c = this._c;
        var _p = this._p;
        var attr = {
            type:'set',
            to:jid
        };
        options = options || {};
        var queryid = options.queryid;
        if (queryid) {
            delete options.queryid;
        } else {
            queryid = _c.getUniqueId();
        }
        var baseIq = $iq(attr).c('query', {xmlns: Strophe.NS.MAM, queryid: queryid}).c('x',{xmlns:'jabber:x:data', type:'submit'});

        baseIq.c('field',{var:'FORM_TYPE', type:'hidden'}).c('value').t(Strophe.NS.MAM).up().up();
        for (var i = 0; i < _p.length; i++) {
            var pn = _p[i];
            var p = options[pn];
            delete options[pn];
            if (p) {
                baseIq.c('field',{var:pn}).c('value').t(p).up().up();
            }
        }
        baseIq.up();

        var onMessage = options.onMessage;
        delete options.onMessage;
        var onComplete = options.onComplete;
        delete options.onComplete;

        var iq = Strophe.copyElement(baseIq.tree());
        iq.firstChild.appendChild(new Strophe.RSM(options).toXML());

        var handler = _c.addHandler(function (message) {
            // TODO: check the emitter too!
            var result = message.firstChild;
            if (!result || result.namespaceURI !== Strophe.NS.MAM || result.localName !== 'result' || result.getAttributeNS(null, 'queryid') !== queryid)
                return true;
            var id = result.getAttributeNS(null, 'id');
            var forwarded = result.firstChild;
            if (!forwarded || forwarded.namespaceURI !== Strophe.NS.Forward || forwarded.localName !== 'forwarded')
                return true;
            var delay = null;
            var childMessage = null;
            for (var child of forwarded.childNodes.values()) {
                if (child.namespaceURI === 'urn:xmpp:delay' && child.localName === 'delay' && delay === null)
                    delay = child;
                else if (child.namespaceURI === 'jabber:client' && child.localName === 'message' && childMessage === null)
                    childMessage = child;
            }
            if (childMessage !== null && delay !== null)
                onMessage(childMessage, delay, id);
            return true;
        }, Strophe.NS.MAM, 'message', null);
        function onIq(result_iq){
            var fin = result_iq.firstChild;
            if (!fin || fin.namespaceURI !== Strophe.NS.MAM || fin.localName !== 'fin' || fin.getAttributeNS(null, 'queryid') !== queryid) {
                console.log('Invalid <fin/> result received in iq:', result_iq);
                return;
            }
            var complete = fin.getAttributeNS(null, 'complete');
            if (complete === 'true') {
                // This is the last page, cancel the handler and call the user callback.
                _c.deleteHandler(handler);
                return onComplete(result_iq);
            }
            // This wasn’t the last page, query the one after the last id we received.
            var set = fin.firstChild;
            if (!set || set.namespaceURI !== Strophe.NS.RSM || set.localName !== 'set') {
                console.log('Invalid <set/> result received in iq:', result_iq);
                return;
            }
            // TODO: is there really nothing better than this to get a direct child in DOM?
            var last = fin.getElementsByTagNameNS(Strophe.NS.RSM, 'last');
            if (!last) {
                console.log('No <last/> in <set/>:', result_iq);
                return;
            }
            options.after = last[0].textContent;
            var iq = Strophe.copyElement(baseIq.tree());
            iq.firstChild.appendChild(new Strophe.RSM(options).toXML());
            _c.sendIQ(iq, onIq);
        }
        return _c.sendIQ(iq, onIq);
    }
});
