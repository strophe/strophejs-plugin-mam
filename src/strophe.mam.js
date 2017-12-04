/* XEP-0313: Message Archive Management
 * Copyright (C) 2012 Kim Alvefur
 *
 * This file is MIT/X11 licensed. Please see the
 * LICENSE.txt file in the source package for more information.
 *
 * Modified by: Chris Tunbridge (github.com/Destreyf/)
 * Updated to support v0.3 of the XMPP XEP-0313 standard
 * http://xmpp.org/extensions/xep-0313.html
 *
 */
//import { $iq, Strophe } from 'strophe.js'; NOTE: Can make issues on some systems

Strophe.addConnectionPlugin('mam', {
    _c: null,
    _p: [ 'with', 'start', 'end' ],
    init: function (conn) {
        this._c = conn;
        Strophe.addNamespace('MAM', 'urn:xmpp:mam:2');
    },
    query: function (jid, options) {
        var _p = this._p;
        var attr = {
            type:'set',
            to:jid
        };
        options = options || {};
        var mamAttr = {xmlns: Strophe.NS.MAM};
        if (!!options.queryid) {
            mamAttr.queryid = options.queryid;
            delete options.queryid;
        }
        var iq = $iq(attr).c('query', mamAttr).c('x',{xmlns:'jabber:x:data', type:'submit'});

        var ns = Strophe.NS.MAM;
        if ( options.oldVersion )
            ns = 'urn:xmpp:mam:1';

        iq.c('field',{var:'FORM_TYPE', type:'hidden'}).c('value').t(ns).up().up();
        var i;
        for (i = 0; i < this._p.length; i++) {
            var pn = _p[i];
            var p = options[pn];
            delete options[pn];
            if (!!p) {
                iq.c('field',{var:pn}).c('value').t(p).up().up();
            }
        }
        iq.up();

        var onMessage = options.onMessage;
        delete options.onMessage;
        var onComplete = options.onComplete;
        delete options.onComplete;
        var onError = options.onError;
        delete options.onError;
        iq.cnode(new Strophe.RSM(options).toXML());

        var _c = this._c;
        var handler = _c.addHandler(onMessage, Strophe.NS.MAM, 'message', null);
        return this._c.sendIQ(iq, function(){
           _c.deleteHandler(handler);
           onComplete.apply(this, arguments);
       },onError);
    }
});
