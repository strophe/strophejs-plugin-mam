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
        var iq = $iq(attr).c('query', {xmlns: Strophe.NS.MAM, queryid: queryid}).c('x',{xmlns:'jabber:x:data', type:'submit'});

        iq.c('field',{var:'FORM_TYPE', type:'hidden'}).c('value').t(Strophe.NS.MAM).up().up();
        for (var i = 0; i < _p.length; i++) {
            var pn = _p[i];
            var p = options[pn];
            delete options[pn];
            if (p) {
                iq.c('field',{var:pn}).c('value').t(p).up().up();
            }
        }
        iq.up();

        var onMessage = options.onMessage;
        delete options.onMessage;
        var onComplete = options.onComplete;
        delete options.onComplete;
        iq.cnode(new Strophe.RSM(options).toXML());

        var handler = _c.addHandler(function (message) {
            // TODO: check the emitter too!
            var result = message.firstChild;
            if (!result || result.namespaceURI !== Strophe.NS.MAM || result.localName !== 'result' || result.getAttributeNS(null, 'queryid') !== queryid)
                return;
            var id = result.getAttributeNS(null, 'id');
            var forwarded = result.firstChild;
            if (!forwarded || forwarded.namespaceURI !== Strophe.NS.Forward || forwarded.localName !== 'forwarded')
                return;
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
        }, Strophe.NS.MAM, 'message', null);
        return _c.sendIQ(iq, function(){
           _c.deleteHandler(handler);
           onComplete.apply(this, arguments);
        });
    }
});
