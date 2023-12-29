// Galerija Carousel MAAD - Updated December 29, 2023
function noop() { }
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
let src_url_equal_anchor;
function src_url_equal(element_src, url) {
    if (!src_url_equal_anchor) {
        src_url_equal_anchor = document.createElement('a');
    }
    src_url_equal_anchor.href = url;
    return element_src === src_url_equal_anchor.href;
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}

// Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
// at the end of hydration without touching the remaining nodes.
let is_hydrating = false;
function start_hydrating() {
    is_hydrating = true;
}
function end_hydrating() {
    is_hydrating = false;
}
function upper_bound(low, high, key, value) {
    // Return first index of value larger than input value in the range [low, high)
    while (low < high) {
        const mid = low + ((high - low) >> 1);
        if (key(mid) <= value) {
            low = mid + 1;
        }
        else {
            high = mid;
        }
    }
    return low;
}
function init_hydrate(target) {
    if (target.hydrate_init)
        return;
    target.hydrate_init = true;
    // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
    let children = target.childNodes;
    // If target is <head>, there may be children without claim_order
    if (target.nodeName === 'HEAD') {
        const myChildren = [];
        for (let i = 0; i < children.length; i++) {
            const node = children[i];
            if (node.claim_order !== undefined) {
                myChildren.push(node);
            }
        }
        children = myChildren;
    }
    /*
    * Reorder claimed children optimally.
    * We can reorder claimed children optimally by finding the longest subsequence of
    * nodes that are already claimed in order and only moving the rest. The longest
    * subsequence of nodes that are claimed in order can be found by
    * computing the longest increasing subsequence of .claim_order values.
    *
    * This algorithm is optimal in generating the least amount of reorder operations
    * possible.
    *
    * Proof:
    * We know that, given a set of reordering operations, the nodes that do not move
    * always form an increasing subsequence, since they do not move among each other
    * meaning that they must be already ordered among each other. Thus, the maximal
    * set of nodes that do not move form a longest increasing subsequence.
    */
    // Compute longest increasing subsequence
    // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
    const m = new Int32Array(children.length + 1);
    // Predecessor indices + 1
    const p = new Int32Array(children.length);
    m[0] = -1;
    let longest = 0;
    for (let i = 0; i < children.length; i++) {
        const current = children[i].claim_order;
        // Find the largest subsequence length such that it ends in a value less than our current value
        // upper_bound returns first greater value, so we subtract one
        // with fast path for when we are on the current longest subsequence
        const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
        p[i] = m[seqLen] + 1;
        const newLen = seqLen + 1;
        // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
        m[newLen] = i;
        longest = Math.max(newLen, longest);
    }
    // The longest increasing subsequence of nodes (initially reversed)
    const lis = [];
    // The rest of the nodes, nodes that will be moved
    const toMove = [];
    let last = children.length - 1;
    for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
        lis.push(children[cur - 1]);
        for (; last >= cur; last--) {
            toMove.push(children[last]);
        }
        last--;
    }
    for (; last >= 0; last--) {
        toMove.push(children[last]);
    }
    lis.reverse();
    // We sort the nodes being moved to guarantee that their insertion order matches the claim order
    toMove.sort((a, b) => a.claim_order - b.claim_order);
    // Finally, we move the nodes
    for (let i = 0, j = 0; i < toMove.length; i++) {
        while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
            j++;
        }
        const anchor = j < lis.length ? lis[j] : null;
        target.insertBefore(toMove[i], anchor);
    }
}
function append_hydration(target, node) {
    if (is_hydrating) {
        init_hydrate(target);
        if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentNode !== target))) {
            target.actual_end_child = target.firstChild;
        }
        // Skip nodes of undefined ordering
        while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
            target.actual_end_child = target.actual_end_child.nextSibling;
        }
        if (node !== target.actual_end_child) {
            // We only insert if the ordering of this node should be modified or the parent node is not target
            if (node.claim_order !== undefined || node.parentNode !== target) {
                target.insertBefore(node, target.actual_end_child);
            }
        }
        else {
            target.actual_end_child = node.nextSibling;
        }
    }
    else if (node.parentNode !== target || node.nextSibling !== null) {
        target.appendChild(node);
    }
}
function insert_hydration(target, node, anchor) {
    if (is_hydrating && !anchor) {
        append_hydration(target, node);
    }
    else if (node.parentNode !== target || node.nextSibling != anchor) {
        target.insertBefore(node, anchor || null);
    }
}
function detach(node) {
    if (node.parentNode) {
        node.parentNode.removeChild(node);
    }
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function set_custom_element_data(node, prop, value) {
    if (prop in node) {
        node[prop] = typeof node[prop] === 'boolean' && value === '' ? true : value;
    }
    else {
        attr(node, prop, value);
    }
}
function children(element) {
    return Array.from(element.childNodes);
}
function init_claim_info(nodes) {
    if (nodes.claim_info === undefined) {
        nodes.claim_info = { last_index: 0, total_claimed: 0 };
    }
}
function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
    // Try to find nodes in an order such that we lengthen the longest increasing subsequence
    init_claim_info(nodes);
    const resultNode = (() => {
        // We first try to find an element after the previous one
        for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                return node;
            }
        }
        // Otherwise, we try to find one before
        // We iterate in reverse so that we don't go too far back
        for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                else if (replacement === undefined) {
                    // Since we spliced before the last_index, we decrease it
                    nodes.claim_info.last_index--;
                }
                return node;
            }
        }
        // If we can't find any matching node, we create a new one
        return createNode();
    })();
    resultNode.claim_order = nodes.claim_info.total_claimed;
    nodes.claim_info.total_claimed += 1;
    return resultNode;
}
function claim_element_base(nodes, name, attributes, create_element) {
    return claim_node(nodes, (node) => node.nodeName === name, (node) => {
        const remove = [];
        for (let j = 0; j < node.attributes.length; j++) {
            const attribute = node.attributes[j];
            if (!attributes[attribute.name]) {
                remove.push(attribute.name);
            }
        }
        remove.forEach(v => node.removeAttribute(v));
        return undefined;
    }, () => create_element(name));
}
function claim_element(nodes, name, attributes) {
    return claim_element_base(nodes, name, attributes, element);
}
function claim_text(nodes, data) {
    return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
        const dataStr = '' + data;
        if (node.data.startsWith(dataStr)) {
            if (node.data.length !== dataStr.length) {
                return node.splitText(dataStr.length);
            }
        }
        else {
            node.data = dataStr;
        }
    }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
    );
}
function claim_space(nodes) {
    return claim_text(nodes, ' ');
}

let current_component;
function set_current_component(component) {
    current_component = component;
}

const dirty_components = [];
const binding_callbacks = [];
let render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = /* @__PURE__ */ Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();
let flushidx = 0; // Do *not* move this inside the flush() function
function flush() {
    // Do not reenter flush while dirty components are updated, as this can
    // result in an infinite loop. Instead, let the inner flush handle it.
    // Reentrancy is ok afterwards for bindings etc.
    if (flushidx !== 0) {
        return;
    }
    const saved_component = current_component;
    do {
        // first, call beforeUpdate functions
        // and update components
        try {
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update$1(component.$$);
            }
        }
        catch (e) {
            // reset dirty state to not end up in a deadlocked state and then rethrow
            dirty_components.length = 0;
            flushidx = 0;
            throw e;
        }
        set_current_component(null);
        dirty_components.length = 0;
        flushidx = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    seen_callbacks.clear();
    set_current_component(saved_component);
}
function update$1($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
/**
 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
 */
function flush_render_callbacks(fns) {
    const filtered = [];
    const targets = [];
    render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
    targets.forEach((c) => c());
    render_callbacks = filtered;
}
const outroing = new Set();
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
            // if the component was destroyed immediately
            // it will update the `$$.on_destroy` reference to `null`.
            // the destructured on_destroy may still reference to the old array
            if (component.$$.on_destroy) {
                component.$$.on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        flush_render_callbacks($$.after_update);
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: [],
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false,
        root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            start_hydrating();
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        end_hydrating();
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        if (!is_function(callback)) {
            return noop;
        }
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

// src/internal/math.ts
function clamp(value, min, max) {
  const noNegativeZero = (n) => Object.is(n, -0) ? 0 : n;
  if (value < min) {
    return noNegativeZero(min);
  }
  if (value > max) {
    return noNegativeZero(max);
  }
  return noNegativeZero(value);
}

// src/components/carousel/autoplay-controller.ts
var AutoplayController = class {
  constructor(host, tickCallback) {
    this.timerId = 0;
    this.activeInteractions = 0;
    this.paused = false;
    this.stopped = true;
    this.pause = () => {
      if (!this.activeInteractions++) {
        this.paused = true;
        this.host.requestUpdate();
      }
    };
    this.resume = () => {
      if (!--this.activeInteractions) {
        this.paused = false;
        this.host.requestUpdate();
      }
    };
    host.addController(this);
    this.host = host;
    this.tickCallback = tickCallback;
  }
  hostConnected() {
    this.host.addEventListener("mouseenter", this.pause);
    this.host.addEventListener("mouseleave", this.resume);
    this.host.addEventListener("focusin", this.pause);
    this.host.addEventListener("focusout", this.resume);
    this.host.addEventListener("touchstart", this.pause, { passive: true });
    this.host.addEventListener("touchend", this.resume);
  }
  hostDisconnected() {
    this.stop();
    this.host.removeEventListener("mouseenter", this.pause);
    this.host.removeEventListener("mouseleave", this.resume);
    this.host.removeEventListener("focusin", this.pause);
    this.host.removeEventListener("focusout", this.resume);
    this.host.removeEventListener("touchstart", this.pause);
    this.host.removeEventListener("touchend", this.resume);
  }
  start(interval) {
    this.stop();
    this.stopped = false;
    this.timerId = window.setInterval(() => {
      if (!this.paused) {
        this.tickCallback();
      }
    }, interval);
  }
  stop() {
    clearInterval(this.timerId);
    this.stopped = true;
    this.host.requestUpdate();
  }
};

// node_modules/lit-element/node_modules/@lit/reactive-element/css-tag.js
var t$1 = globalThis;
var e$3 = t$1.ShadowRoot && (void 0 === t$1.ShadyCSS || t$1.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
var s = Symbol();
var o$2 = /* @__PURE__ */ new WeakMap();
var n$1 = class n {
  constructor(t5, e7, o7) {
    if (this._$cssResult$ = true, o7 !== s)
      throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t5, this.t = e7;
  }
  get styleSheet() {
    let t5 = this.o;
    const s6 = this.t;
    if (e$3 && void 0 === t5) {
      const e7 = void 0 !== s6 && 1 === s6.length;
      e7 && (t5 = o$2.get(s6)), void 0 === t5 && ((this.o = t5 = new CSSStyleSheet()).replaceSync(this.cssText), e7 && o$2.set(s6, t5));
    }
    return t5;
  }
  toString() {
    return this.cssText;
  }
};
var r$1 = (t5) => new n$1("string" == typeof t5 ? t5 : t5 + "", void 0, s);
var i$1 = (t5, ...e7) => {
  const o7 = 1 === t5.length ? t5[0] : e7.reduce((e8, s6, o8) => e8 + ((t6) => {
    if (true === t6._$cssResult$)
      return t6.cssText;
    if ("number" == typeof t6)
      return t6;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + t6 + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s6) + t5[o8 + 1], t5[0]);
  return new n$1(o7, t5, s);
};
var S = (s6, o7) => {
  if (e$3)
    s6.adoptedStyleSheets = o7.map((t5) => t5 instanceof CSSStyleSheet ? t5 : t5.styleSheet);
  else
    for (const e7 of o7) {
      const o8 = document.createElement("style"), n7 = t$1.litNonce;
      void 0 !== n7 && o8.setAttribute("nonce", n7), o8.textContent = e7.cssText, s6.appendChild(o8);
    }
};
var c = e$3 ? (t5) => t5 : (t5) => t5 instanceof CSSStyleSheet ? ((t6) => {
  let e7 = "";
  for (const s6 of t6.cssRules)
    e7 += s6.cssText;
  return r$1(e7);
})(t5) : t5;

// node_modules/lit-element/node_modules/@lit/reactive-element/reactive-element.js
var { is: i2, defineProperty: e2$2, getOwnPropertyDescriptor: r2$1, getOwnPropertyNames: h, getOwnPropertySymbols: o2$1, getPrototypeOf: n2 } = Object;
var a = globalThis;
var c2 = a.trustedTypes;
var l = c2 ? c2.emptyScript : "";
var p = a.reactiveElementPolyfillSupport;
var d = (t5, s6) => t5;
var u = { toAttribute(t5, s6) {
  switch (s6) {
    case Boolean:
      t5 = t5 ? l : null;
      break;
    case Object:
    case Array:
      t5 = null == t5 ? t5 : JSON.stringify(t5);
  }
  return t5;
}, fromAttribute(t5, s6) {
  let i7 = t5;
  switch (s6) {
    case Boolean:
      i7 = null !== t5;
      break;
    case Number:
      i7 = null === t5 ? null : Number(t5);
      break;
    case Object:
    case Array:
      try {
        i7 = JSON.parse(t5);
      } catch (t6) {
        i7 = null;
      }
  }
  return i7;
} };
var f = (t5, s6) => !i2(t5, s6);
var y = { attribute: true, type: String, converter: u, reflect: false, hasChanged: f };
var _a, _b;
(_a = Symbol.metadata) != null ? _a : Symbol.metadata = Symbol("metadata"), (_b = a.litPropertyMetadata) != null ? _b : a.litPropertyMetadata = /* @__PURE__ */ new WeakMap();
var b = class extends HTMLElement {
  static addInitializer(t5) {
    var _a9;
    this._$Ei(), ((_a9 = this.l) != null ? _a9 : this.l = []).push(t5);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t5, s6 = y) {
    if (s6.state && (s6.attribute = false), this._$Ei(), this.elementProperties.set(t5, s6), !s6.noAccessor) {
      const i7 = Symbol(), r8 = this.getPropertyDescriptor(t5, i7, s6);
      void 0 !== r8 && e2$2(this.prototype, t5, r8);
    }
  }
  static getPropertyDescriptor(t5, s6, i7) {
    var _a9;
    const { get: e7, set: h5 } = (_a9 = r2$1(this.prototype, t5)) != null ? _a9 : { get() {
      return this[s6];
    }, set(t6) {
      this[s6] = t6;
    } };
    return { get() {
      return e7 == null ? void 0 : e7.call(this);
    }, set(s7) {
      const r8 = e7 == null ? void 0 : e7.call(this);
      h5.call(this, s7), this.requestUpdate(t5, r8, i7);
    }, configurable: true, enumerable: true };
  }
  static getPropertyOptions(t5) {
    var _a9;
    return (_a9 = this.elementProperties.get(t5)) != null ? _a9 : y;
  }
  static _$Ei() {
    if (this.hasOwnProperty(d("elementProperties")))
      return;
    const t5 = n2(this);
    t5.finalize(), void 0 !== t5.l && (this.l = [...t5.l]), this.elementProperties = new Map(t5.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(d("finalized")))
      return;
    if (this.finalized = true, this._$Ei(), this.hasOwnProperty(d("properties"))) {
      const t6 = this.properties, s6 = [...h(t6), ...o2$1(t6)];
      for (const i7 of s6)
        this.createProperty(i7, t6[i7]);
    }
    const t5 = this[Symbol.metadata];
    if (null !== t5) {
      const s6 = litPropertyMetadata.get(t5);
      if (void 0 !== s6)
        for (const [t6, i7] of s6)
          this.elementProperties.set(t6, i7);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [t6, s6] of this.elementProperties) {
      const i7 = this._$Eu(t6, s6);
      void 0 !== i7 && this._$Eh.set(i7, t6);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(s6) {
    const i7 = [];
    if (Array.isArray(s6)) {
      const e7 = new Set(s6.flat(1 / 0).reverse());
      for (const s7 of e7)
        i7.unshift(c(s7));
    } else
      void 0 !== s6 && i7.push(c(s6));
    return i7;
  }
  static _$Eu(t5, s6) {
    const i7 = s6.attribute;
    return false === i7 ? void 0 : "string" == typeof i7 ? i7 : "string" == typeof t5 ? t5.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = false, this.hasUpdated = false, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    var _a9;
    this._$Eg = new Promise((t5) => this.enableUpdating = t5), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), (_a9 = this.constructor.l) == null ? void 0 : _a9.forEach((t5) => t5(this));
  }
  addController(t5) {
    var _a9, _b4;
    ((_a9 = this._$ES) != null ? _a9 : this._$ES = []).push(t5), void 0 !== this.renderRoot && this.isConnected && ((_b4 = t5.hostConnected) == null ? void 0 : _b4.call(t5));
  }
  removeController(t5) {
    var _a9;
    (_a9 = this._$ES) == null ? void 0 : _a9.splice(this._$ES.indexOf(t5) >>> 0, 1);
  }
  _$E_() {
    const t5 = /* @__PURE__ */ new Map(), s6 = this.constructor.elementProperties;
    for (const i7 of s6.keys())
      this.hasOwnProperty(i7) && (t5.set(i7, this[i7]), delete this[i7]);
    t5.size > 0 && (this._$Ep = t5);
  }
  createRenderRoot() {
    var _a9;
    const t5 = (_a9 = this.shadowRoot) != null ? _a9 : this.attachShadow(this.constructor.shadowRootOptions);
    return S(t5, this.constructor.elementStyles), t5;
  }
  connectedCallback() {
    var _a9, _b4;
    (_a9 = this.renderRoot) != null ? _a9 : this.renderRoot = this.createRenderRoot(), this.enableUpdating(true), (_b4 = this._$ES) == null ? void 0 : _b4.forEach((t5) => {
      var _a10;
      return (_a10 = t5.hostConnected) == null ? void 0 : _a10.call(t5);
    });
  }
  enableUpdating(t5) {
  }
  disconnectedCallback() {
    var _a9;
    (_a9 = this._$ES) == null ? void 0 : _a9.forEach((t5) => {
      var _a10;
      return (_a10 = t5.hostDisconnected) == null ? void 0 : _a10.call(t5);
    });
  }
  attributeChangedCallback(t5, s6, i7) {
    this._$AK(t5, i7);
  }
  _$EO(t5, s6) {
    var _a9;
    const i7 = this.constructor.elementProperties.get(t5), e7 = this.constructor._$Eu(t5, i7);
    if (void 0 !== e7 && true === i7.reflect) {
      const r8 = (void 0 !== ((_a9 = i7.converter) == null ? void 0 : _a9.toAttribute) ? i7.converter : u).toAttribute(s6, i7.type);
      this._$Em = t5, null == r8 ? this.removeAttribute(e7) : this.setAttribute(e7, r8), this._$Em = null;
    }
  }
  _$AK(t5, s6) {
    var _a9;
    const i7 = this.constructor, e7 = i7._$Eh.get(t5);
    if (void 0 !== e7 && this._$Em !== e7) {
      const t6 = i7.getPropertyOptions(e7), r8 = "function" == typeof t6.converter ? { fromAttribute: t6.converter } : void 0 !== ((_a9 = t6.converter) == null ? void 0 : _a9.fromAttribute) ? t6.converter : u;
      this._$Em = e7, this[e7] = r8.fromAttribute(s6, t6.type), this._$Em = null;
    }
  }
  requestUpdate(t5, s6, i7, e7 = false, r8) {
    var _a9;
    if (void 0 !== t5) {
      if (i7 != null ? i7 : i7 = this.constructor.getPropertyOptions(t5), !((_a9 = i7.hasChanged) != null ? _a9 : f)(e7 ? r8 : this[t5], s6))
        return;
      this.C(t5, s6, i7);
    }
    false === this.isUpdatePending && (this._$Eg = this._$EP());
  }
  C(t5, s6, i7) {
    var _a9;
    this._$AL.has(t5) || this._$AL.set(t5, s6), true === i7.reflect && this._$Em !== t5 && ((_a9 = this._$Ej) != null ? _a9 : this._$Ej = /* @__PURE__ */ new Set()).add(t5);
  }
  async _$EP() {
    this.isUpdatePending = true;
    try {
      await this._$Eg;
    } catch (t6) {
      Promise.reject(t6);
    }
    const t5 = this.scheduleUpdate();
    return null != t5 && await t5, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    var _a9;
    if (!this.isUpdatePending)
      return;
    if (!this.hasUpdated) {
      if (this._$Ep) {
        for (const [t7, s7] of this._$Ep)
          this[t7] = s7;
        this._$Ep = void 0;
      }
      const t6 = this.constructor.elementProperties;
      if (t6.size > 0)
        for (const [s7, i7] of t6)
          true !== i7.wrapped || this._$AL.has(s7) || void 0 === this[s7] || this.C(s7, this[s7], i7);
    }
    let t5 = false;
    const s6 = this._$AL;
    try {
      t5 = this.shouldUpdate(s6), t5 ? (this.willUpdate(s6), (_a9 = this._$ES) == null ? void 0 : _a9.forEach((t6) => {
        var _a10;
        return (_a10 = t6.hostUpdate) == null ? void 0 : _a10.call(t6);
      }), this.update(s6)) : this._$ET();
    } catch (s7) {
      throw t5 = false, this._$ET(), s7;
    }
    t5 && this._$AE(s6);
  }
  willUpdate(t5) {
  }
  _$AE(t5) {
    var _a9;
    (_a9 = this._$ES) == null ? void 0 : _a9.forEach((t6) => {
      var _a10;
      return (_a10 = t6.hostUpdated) == null ? void 0 : _a10.call(t6);
    }), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(t5)), this.updated(t5);
  }
  _$ET() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = false;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$Eg;
  }
  shouldUpdate(t5) {
    return true;
  }
  update(t5) {
    this._$Ej && (this._$Ej = this._$Ej.forEach((t6) => this._$EO(t6, this[t6]))), this._$ET();
  }
  updated(t5) {
  }
  firstUpdated(t5) {
  }
};
var _a2;
b.elementStyles = [], b.shadowRootOptions = { mode: "open" }, b[d("elementProperties")] = /* @__PURE__ */ new Map(), b[d("finalized")] = /* @__PURE__ */ new Map(), p == null ? void 0 : p({ ReactiveElement: b }), ((_a2 = a.reactiveElementVersions) != null ? _a2 : a.reactiveElementVersions = []).push("2.0.0");

// node_modules/lit-element/node_modules/lit-html/lit-html.js
var t2 = globalThis;
var i3 = t2.trustedTypes;
var s2 = i3 ? i3.createPolicy("lit-html", { createHTML: (t5) => t5 }) : void 0;
var e3 = "$lit$";
var h2 = `lit$${(Math.random() + "").slice(9)}$`;
var o3 = "?" + h2;
var n3 = `<${o3}>`;
var r3 = document;
var l2 = () => r3.createComment("");
var c3 = (t5) => null === t5 || "object" != typeof t5 && "function" != typeof t5;
var a2 = Array.isArray;
var u2 = (t5) => a2(t5) || "function" == typeof (t5 == null ? void 0 : t5[Symbol.iterator]);
var d2 = "[ 	\n\f\r]";
var f2 = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var v = /-->/g;
var _ = />/g;
var m = RegExp(`>|${d2}(?:([^\\s"'>=/]+)(${d2}*=${d2}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var p2 = /'/g;
var g = /"/g;
var $ = /^(?:script|style|textarea|title)$/i;
var y2 = (t5) => (i7, ...s6) => ({ _$litType$: t5, strings: i7, values: s6 });
var x = y2(1);
var w = Symbol.for("lit-noChange");
var T = Symbol.for("lit-nothing");
var A = /* @__PURE__ */ new WeakMap();
var E = r3.createTreeWalker(r3, 129);
function C(t5, i7) {
  if (!Array.isArray(t5) || !t5.hasOwnProperty("raw"))
    throw Error("invalid template strings array");
  return void 0 !== s2 ? s2.createHTML(i7) : i7;
}
var P = (t5, i7) => {
  const s6 = t5.length - 1, o7 = [];
  let r8, l5 = 2 === i7 ? "<svg>" : "", c7 = f2;
  for (let i8 = 0; i8 < s6; i8++) {
    const s7 = t5[i8];
    let a5, u5, d5 = -1, y5 = 0;
    for (; y5 < s7.length && (c7.lastIndex = y5, u5 = c7.exec(s7), null !== u5); )
      y5 = c7.lastIndex, c7 === f2 ? "!--" === u5[1] ? c7 = v : void 0 !== u5[1] ? c7 = _ : void 0 !== u5[2] ? ($.test(u5[2]) && (r8 = RegExp("</" + u5[2], "g")), c7 = m) : void 0 !== u5[3] && (c7 = m) : c7 === m ? ">" === u5[0] ? (c7 = r8 != null ? r8 : f2, d5 = -1) : void 0 === u5[1] ? d5 = -2 : (d5 = c7.lastIndex - u5[2].length, a5 = u5[1], c7 = void 0 === u5[3] ? m : '"' === u5[3] ? g : p2) : c7 === g || c7 === p2 ? c7 = m : c7 === v || c7 === _ ? c7 = f2 : (c7 = m, r8 = void 0);
    const x3 = c7 === m && t5[i8 + 1].startsWith("/>") ? " " : "";
    l5 += c7 === f2 ? s7 + n3 : d5 >= 0 ? (o7.push(a5), s7.slice(0, d5) + e3 + s7.slice(d5) + h2 + x3) : s7 + h2 + (-2 === d5 ? i8 : x3);
  }
  return [C(t5, l5 + (t5[s6] || "<?>") + (2 === i7 ? "</svg>" : "")), o7];
};
var V = class _V {
  constructor({ strings: t5, _$litType$: s6 }, n7) {
    let r8;
    this.parts = [];
    let c7 = 0, a5 = 0;
    const u5 = t5.length - 1, d5 = this.parts, [f5, v3] = P(t5, s6);
    if (this.el = _V.createElement(f5, n7), E.currentNode = this.el.content, 2 === s6) {
      const t6 = this.el.content.firstChild;
      t6.replaceWith(...t6.childNodes);
    }
    for (; null !== (r8 = E.nextNode()) && d5.length < u5; ) {
      if (1 === r8.nodeType) {
        if (r8.hasAttributes())
          for (const t6 of r8.getAttributeNames())
            if (t6.endsWith(e3)) {
              const i7 = v3[a5++], s7 = r8.getAttribute(t6).split(h2), e7 = /([.?@])?(.*)/.exec(i7);
              d5.push({ type: 1, index: c7, name: e7[2], strings: s7, ctor: "." === e7[1] ? k : "?" === e7[1] ? H : "@" === e7[1] ? I : R }), r8.removeAttribute(t6);
            } else
              t6.startsWith(h2) && (d5.push({ type: 6, index: c7 }), r8.removeAttribute(t6));
        if ($.test(r8.tagName)) {
          const t6 = r8.textContent.split(h2), s7 = t6.length - 1;
          if (s7 > 0) {
            r8.textContent = i3 ? i3.emptyScript : "";
            for (let i7 = 0; i7 < s7; i7++)
              r8.append(t6[i7], l2()), E.nextNode(), d5.push({ type: 2, index: ++c7 });
            r8.append(t6[s7], l2());
          }
        }
      } else if (8 === r8.nodeType)
        if (r8.data === o3)
          d5.push({ type: 2, index: c7 });
        else {
          let t6 = -1;
          for (; -1 !== (t6 = r8.data.indexOf(h2, t6 + 1)); )
            d5.push({ type: 7, index: c7 }), t6 += h2.length - 1;
        }
      c7++;
    }
  }
  static createElement(t5, i7) {
    const s6 = r3.createElement("template");
    return s6.innerHTML = t5, s6;
  }
};
function N(t5, i7, s6 = t5, e7) {
  var _a9, _b3, _c;
  if (i7 === w)
    return i7;
  let h5 = void 0 !== e7 ? (_a9 = s6._$Co) == null ? void 0 : _a9[e7] : s6._$Cl;
  const o7 = c3(i7) ? void 0 : i7._$litDirective$;
  return (h5 == null ? void 0 : h5.constructor) !== o7 && ((_b3 = h5 == null ? void 0 : h5._$AO) == null ? void 0 : _b3.call(h5, false), void 0 === o7 ? h5 = void 0 : (h5 = new o7(t5), h5._$AT(t5, s6, e7)), void 0 !== e7 ? ((_c = s6._$Co) != null ? _c : s6._$Co = [])[e7] = h5 : s6._$Cl = h5), void 0 !== h5 && (i7 = N(t5, h5._$AS(t5, i7.values), h5, e7)), i7;
}
var S2 = class {
  constructor(t5, i7) {
    this._$AV = [], this._$AN = void 0, this._$AD = t5, this._$AM = i7;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t5) {
    var _a9;
    const { el: { content: i7 }, parts: s6 } = this._$AD, e7 = ((_a9 = t5 == null ? void 0 : t5.creationScope) != null ? _a9 : r3).importNode(i7, true);
    E.currentNode = e7;
    let h5 = E.nextNode(), o7 = 0, n7 = 0, l5 = s6[0];
    for (; void 0 !== l5; ) {
      if (o7 === l5.index) {
        let i8;
        2 === l5.type ? i8 = new M(h5, h5.nextSibling, this, t5) : 1 === l5.type ? i8 = new l5.ctor(h5, l5.name, l5.strings, this, t5) : 6 === l5.type && (i8 = new L(h5, this, t5)), this._$AV.push(i8), l5 = s6[++n7];
      }
      o7 !== (l5 == null ? void 0 : l5.index) && (h5 = E.nextNode(), o7++);
    }
    return E.currentNode = r3, e7;
  }
  p(t5) {
    let i7 = 0;
    for (const s6 of this._$AV)
      void 0 !== s6 && (void 0 !== s6.strings ? (s6._$AI(t5, s6, i7), i7 += s6.strings.length - 2) : s6._$AI(t5[i7])), i7++;
  }
};
var M = class _M {
  get _$AU() {
    var _a9, _b3;
    return (_b3 = (_a9 = this._$AM) == null ? void 0 : _a9._$AU) != null ? _b3 : this._$Cv;
  }
  constructor(t5, i7, s6, e7) {
    var _a9;
    this.type = 2, this._$AH = T, this._$AN = void 0, this._$AA = t5, this._$AB = i7, this._$AM = s6, this.options = e7, this._$Cv = (_a9 = e7 == null ? void 0 : e7.isConnected) != null ? _a9 : true;
  }
  get parentNode() {
    let t5 = this._$AA.parentNode;
    const i7 = this._$AM;
    return void 0 !== i7 && 11 === (t5 == null ? void 0 : t5.nodeType) && (t5 = i7.parentNode), t5;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t5, i7 = this) {
    t5 = N(this, t5, i7), c3(t5) ? t5 === T || null == t5 || "" === t5 ? (this._$AH !== T && this._$AR(), this._$AH = T) : t5 !== this._$AH && t5 !== w && this._(t5) : void 0 !== t5._$litType$ ? this.g(t5) : void 0 !== t5.nodeType ? this.$(t5) : u2(t5) ? this.T(t5) : this._(t5);
  }
  k(t5) {
    return this._$AA.parentNode.insertBefore(t5, this._$AB);
  }
  $(t5) {
    this._$AH !== t5 && (this._$AR(), this._$AH = this.k(t5));
  }
  _(t5) {
    this._$AH !== T && c3(this._$AH) ? this._$AA.nextSibling.data = t5 : this.$(r3.createTextNode(t5)), this._$AH = t5;
  }
  g(t5) {
    var _a9;
    const { values: i7, _$litType$: s6 } = t5, e7 = "number" == typeof s6 ? this._$AC(t5) : (void 0 === s6.el && (s6.el = V.createElement(C(s6.h, s6.h[0]), this.options)), s6);
    if (((_a9 = this._$AH) == null ? void 0 : _a9._$AD) === e7)
      this._$AH.p(i7);
    else {
      const t6 = new S2(e7, this), s7 = t6.u(this.options);
      t6.p(i7), this.$(s7), this._$AH = t6;
    }
  }
  _$AC(t5) {
    let i7 = A.get(t5.strings);
    return void 0 === i7 && A.set(t5.strings, i7 = new V(t5)), i7;
  }
  T(t5) {
    a2(this._$AH) || (this._$AH = [], this._$AR());
    const i7 = this._$AH;
    let s6, e7 = 0;
    for (const h5 of t5)
      e7 === i7.length ? i7.push(s6 = new _M(this.k(l2()), this.k(l2()), this, this.options)) : s6 = i7[e7], s6._$AI(h5), e7++;
    e7 < i7.length && (this._$AR(s6 && s6._$AB.nextSibling, e7), i7.length = e7);
  }
  _$AR(t5 = this._$AA.nextSibling, i7) {
    var _a9;
    for ((_a9 = this._$AP) == null ? void 0 : _a9.call(this, false, true, i7); t5 && t5 !== this._$AB; ) {
      const i8 = t5.nextSibling;
      t5.remove(), t5 = i8;
    }
  }
  setConnected(t5) {
    var _a9;
    void 0 === this._$AM && (this._$Cv = t5, (_a9 = this._$AP) == null ? void 0 : _a9.call(this, t5));
  }
};
var R = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t5, i7, s6, e7, h5) {
    this.type = 1, this._$AH = T, this._$AN = void 0, this.element = t5, this.name = i7, this._$AM = e7, this.options = h5, s6.length > 2 || "" !== s6[0] || "" !== s6[1] ? (this._$AH = Array(s6.length - 1).fill(new String()), this.strings = s6) : this._$AH = T;
  }
  _$AI(t5, i7 = this, s6, e7) {
    const h5 = this.strings;
    let o7 = false;
    if (void 0 === h5)
      t5 = N(this, t5, i7, 0), o7 = !c3(t5) || t5 !== this._$AH && t5 !== w, o7 && (this._$AH = t5);
    else {
      const e8 = t5;
      let n7, r8;
      for (t5 = h5[0], n7 = 0; n7 < h5.length - 1; n7++)
        r8 = N(this, e8[s6 + n7], i7, n7), r8 === w && (r8 = this._$AH[n7]), o7 || (o7 = !c3(r8) || r8 !== this._$AH[n7]), r8 === T ? t5 = T : t5 !== T && (t5 += (r8 != null ? r8 : "") + h5[n7 + 1]), this._$AH[n7] = r8;
    }
    o7 && !e7 && this.j(t5);
  }
  j(t5) {
    t5 === T ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t5 != null ? t5 : "");
  }
};
var k = class extends R {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t5) {
    this.element[this.name] = t5 === T ? void 0 : t5;
  }
};
var H = class extends R {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t5) {
    this.element.toggleAttribute(this.name, !!t5 && t5 !== T);
  }
};
var I = class extends R {
  constructor(t5, i7, s6, e7, h5) {
    super(t5, i7, s6, e7, h5), this.type = 5;
  }
  _$AI(t5, i7 = this) {
    var _a9;
    if ((t5 = (_a9 = N(this, t5, i7, 0)) != null ? _a9 : T) === w)
      return;
    const s6 = this._$AH, e7 = t5 === T && s6 !== T || t5.capture !== s6.capture || t5.once !== s6.once || t5.passive !== s6.passive, h5 = t5 !== T && (s6 === T || e7);
    e7 && this.element.removeEventListener(this.name, this, s6), h5 && this.element.addEventListener(this.name, this, t5), this._$AH = t5;
  }
  handleEvent(t5) {
    var _a9, _b3;
    "function" == typeof this._$AH ? this._$AH.call((_b3 = (_a9 = this.options) == null ? void 0 : _a9.host) != null ? _b3 : this.element, t5) : this._$AH.handleEvent(t5);
  }
};
var L = class {
  constructor(t5, i7, s6) {
    this.element = t5, this.type = 6, this._$AN = void 0, this._$AM = i7, this.options = s6;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t5) {
    N(this, t5);
  }
};
var Z = t2.litHtmlPolyfillSupport;
var _a3;
Z == null ? void 0 : Z(V, M), ((_a3 = t2.litHtmlVersions) != null ? _a3 : t2.litHtmlVersions = []).push("3.0.0");
var j = (t5, i7, s6) => {
  var _a9, _b3;
  const e7 = (_a9 = s6 == null ? void 0 : s6.renderBefore) != null ? _a9 : i7;
  let h5 = e7._$litPart$;
  if (void 0 === h5) {
    const t6 = (_b3 = s6 == null ? void 0 : s6.renderBefore) != null ? _b3 : null;
    e7._$litPart$ = h5 = new M(i7.insertBefore(l2(), t6), t6, void 0, s6 != null ? s6 : {});
  }
  return h5._$AI(t5), h5;
};

// node_modules/lit/node_modules/@lit/reactive-element/css-tag.js
var t3 = globalThis;
var e4 = t3.ShadowRoot && (void 0 === t3.ShadyCSS || t3.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
var s3 = Symbol();
var o4 = /* @__PURE__ */ new WeakMap();
var n4 = class {
  constructor(t5, e7, o7) {
    if (this._$cssResult$ = true, o7 !== s3)
      throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t5, this.t = e7;
  }
  get styleSheet() {
    let t5 = this.o;
    const s6 = this.t;
    if (e4 && void 0 === t5) {
      const e7 = void 0 !== s6 && 1 === s6.length;
      e7 && (t5 = o4.get(s6)), void 0 === t5 && ((this.o = t5 = new CSSStyleSheet()).replaceSync(this.cssText), e7 && o4.set(s6, t5));
    }
    return t5;
  }
  toString() {
    return this.cssText;
  }
};
var r4 = (t5) => new n4("string" == typeof t5 ? t5 : t5 + "", void 0, s3);
var S3 = (s6, o7) => {
  if (e4)
    s6.adoptedStyleSheets = o7.map((t5) => t5 instanceof CSSStyleSheet ? t5 : t5.styleSheet);
  else
    for (const e7 of o7) {
      const o8 = document.createElement("style"), n7 = t3.litNonce;
      void 0 !== n7 && o8.setAttribute("nonce", n7), o8.textContent = e7.cssText, s6.appendChild(o8);
    }
};
var c4 = e4 ? (t5) => t5 : (t5) => t5 instanceof CSSStyleSheet ? ((t6) => {
  let e7 = "";
  for (const s6 of t6.cssRules)
    e7 += s6.cssText;
  return r4(e7);
})(t5) : t5;

// node_modules/lit/node_modules/@lit/reactive-element/reactive-element.js
var { is: i5, defineProperty: e5, getOwnPropertyDescriptor: r5, getOwnPropertyNames: h3, getOwnPropertySymbols: o5, getPrototypeOf: n5 } = Object;
var a3 = globalThis;
var c5 = a3.trustedTypes;
var l3 = c5 ? c5.emptyScript : "";
var p3 = a3.reactiveElementPolyfillSupport;
var d3 = (t5, s6) => t5;
var u3 = { toAttribute(t5, s6) {
  switch (s6) {
    case Boolean:
      t5 = t5 ? l3 : null;
      break;
    case Object:
    case Array:
      t5 = null == t5 ? t5 : JSON.stringify(t5);
  }
  return t5;
}, fromAttribute(t5, s6) {
  let i7 = t5;
  switch (s6) {
    case Boolean:
      i7 = null !== t5;
      break;
    case Number:
      i7 = null === t5 ? null : Number(t5);
      break;
    case Object:
    case Array:
      try {
        i7 = JSON.parse(t5);
      } catch (t6) {
        i7 = null;
      }
  }
  return i7;
} };
var f3 = (t5, s6) => !i5(t5, s6);
var y3 = { attribute: true, type: String, converter: u3, reflect: false, hasChanged: f3 };
var _a4, _b2;
(_a4 = Symbol.metadata) != null ? _a4 : Symbol.metadata = Symbol("metadata"), (_b2 = a3.litPropertyMetadata) != null ? _b2 : a3.litPropertyMetadata = /* @__PURE__ */ new WeakMap();
var b3 = class extends HTMLElement {
  static addInitializer(t5) {
    var _a9;
    this._$Ei(), ((_a9 = this.l) != null ? _a9 : this.l = []).push(t5);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t5, s6 = y3) {
    if (s6.state && (s6.attribute = false), this._$Ei(), this.elementProperties.set(t5, s6), !s6.noAccessor) {
      const i7 = Symbol(), r8 = this.getPropertyDescriptor(t5, i7, s6);
      void 0 !== r8 && e5(this.prototype, t5, r8);
    }
  }
  static getPropertyDescriptor(t5, s6, i7) {
    var _a9;
    const { get: e7, set: h5 } = (_a9 = r5(this.prototype, t5)) != null ? _a9 : { get() {
      return this[s6];
    }, set(t6) {
      this[s6] = t6;
    } };
    return { get() {
      return e7 == null ? void 0 : e7.call(this);
    }, set(s7) {
      const r8 = e7 == null ? void 0 : e7.call(this);
      h5.call(this, s7), this.requestUpdate(t5, r8, i7);
    }, configurable: true, enumerable: true };
  }
  static getPropertyOptions(t5) {
    var _a9;
    return (_a9 = this.elementProperties.get(t5)) != null ? _a9 : y3;
  }
  static _$Ei() {
    if (this.hasOwnProperty(d3("elementProperties")))
      return;
    const t5 = n5(this);
    t5.finalize(), void 0 !== t5.l && (this.l = [...t5.l]), this.elementProperties = new Map(t5.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(d3("finalized")))
      return;
    if (this.finalized = true, this._$Ei(), this.hasOwnProperty(d3("properties"))) {
      const t6 = this.properties, s6 = [...h3(t6), ...o5(t6)];
      for (const i7 of s6)
        this.createProperty(i7, t6[i7]);
    }
    const t5 = this[Symbol.metadata];
    if (null !== t5) {
      const s6 = litPropertyMetadata.get(t5);
      if (void 0 !== s6)
        for (const [t6, i7] of s6)
          this.elementProperties.set(t6, i7);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [t6, s6] of this.elementProperties) {
      const i7 = this._$Eu(t6, s6);
      void 0 !== i7 && this._$Eh.set(i7, t6);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(s6) {
    const i7 = [];
    if (Array.isArray(s6)) {
      const e7 = new Set(s6.flat(1 / 0).reverse());
      for (const s7 of e7)
        i7.unshift(c4(s7));
    } else
      void 0 !== s6 && i7.push(c4(s6));
    return i7;
  }
  static _$Eu(t5, s6) {
    const i7 = s6.attribute;
    return false === i7 ? void 0 : "string" == typeof i7 ? i7 : "string" == typeof t5 ? t5.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = false, this.hasUpdated = false, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    var _a9;
    this._$Eg = new Promise((t5) => this.enableUpdating = t5), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), (_a9 = this.constructor.l) == null ? void 0 : _a9.forEach((t5) => t5(this));
  }
  addController(t5) {
    var _a9, _b4;
    ((_a9 = this._$ES) != null ? _a9 : this._$ES = []).push(t5), void 0 !== this.renderRoot && this.isConnected && ((_b4 = t5.hostConnected) == null ? void 0 : _b4.call(t5));
  }
  removeController(t5) {
    var _a9;
    (_a9 = this._$ES) == null ? void 0 : _a9.splice(this._$ES.indexOf(t5) >>> 0, 1);
  }
  _$E_() {
    const t5 = /* @__PURE__ */ new Map(), s6 = this.constructor.elementProperties;
    for (const i7 of s6.keys())
      this.hasOwnProperty(i7) && (t5.set(i7, this[i7]), delete this[i7]);
    t5.size > 0 && (this._$Ep = t5);
  }
  createRenderRoot() {
    var _a9;
    const t5 = (_a9 = this.shadowRoot) != null ? _a9 : this.attachShadow(this.constructor.shadowRootOptions);
    return S3(t5, this.constructor.elementStyles), t5;
  }
  connectedCallback() {
    var _a9, _b4;
    (_a9 = this.renderRoot) != null ? _a9 : this.renderRoot = this.createRenderRoot(), this.enableUpdating(true), (_b4 = this._$ES) == null ? void 0 : _b4.forEach((t5) => {
      var _a10;
      return (_a10 = t5.hostConnected) == null ? void 0 : _a10.call(t5);
    });
  }
  enableUpdating(t5) {
  }
  disconnectedCallback() {
    var _a9;
    (_a9 = this._$ES) == null ? void 0 : _a9.forEach((t5) => {
      var _a10;
      return (_a10 = t5.hostDisconnected) == null ? void 0 : _a10.call(t5);
    });
  }
  attributeChangedCallback(t5, s6, i7) {
    this._$AK(t5, i7);
  }
  _$EO(t5, s6) {
    var _a9;
    const i7 = this.constructor.elementProperties.get(t5), e7 = this.constructor._$Eu(t5, i7);
    if (void 0 !== e7 && true === i7.reflect) {
      const r8 = (void 0 !== ((_a9 = i7.converter) == null ? void 0 : _a9.toAttribute) ? i7.converter : u3).toAttribute(s6, i7.type);
      this._$Em = t5, null == r8 ? this.removeAttribute(e7) : this.setAttribute(e7, r8), this._$Em = null;
    }
  }
  _$AK(t5, s6) {
    var _a9;
    const i7 = this.constructor, e7 = i7._$Eh.get(t5);
    if (void 0 !== e7 && this._$Em !== e7) {
      const t6 = i7.getPropertyOptions(e7), r8 = "function" == typeof t6.converter ? { fromAttribute: t6.converter } : void 0 !== ((_a9 = t6.converter) == null ? void 0 : _a9.fromAttribute) ? t6.converter : u3;
      this._$Em = e7, this[e7] = r8.fromAttribute(s6, t6.type), this._$Em = null;
    }
  }
  requestUpdate(t5, s6, i7, e7 = false, r8) {
    var _a9;
    if (void 0 !== t5) {
      if (i7 != null ? i7 : i7 = this.constructor.getPropertyOptions(t5), !((_a9 = i7.hasChanged) != null ? _a9 : f3)(e7 ? r8 : this[t5], s6))
        return;
      this.C(t5, s6, i7);
    }
    false === this.isUpdatePending && (this._$Eg = this._$EP());
  }
  C(t5, s6, i7) {
    var _a9;
    this._$AL.has(t5) || this._$AL.set(t5, s6), true === i7.reflect && this._$Em !== t5 && ((_a9 = this._$Ej) != null ? _a9 : this._$Ej = /* @__PURE__ */ new Set()).add(t5);
  }
  async _$EP() {
    this.isUpdatePending = true;
    try {
      await this._$Eg;
    } catch (t6) {
      Promise.reject(t6);
    }
    const t5 = this.scheduleUpdate();
    return null != t5 && await t5, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    var _a9;
    if (!this.isUpdatePending)
      return;
    if (!this.hasUpdated) {
      if (this._$Ep) {
        for (const [t7, s7] of this._$Ep)
          this[t7] = s7;
        this._$Ep = void 0;
      }
      const t6 = this.constructor.elementProperties;
      if (t6.size > 0)
        for (const [s7, i7] of t6)
          true !== i7.wrapped || this._$AL.has(s7) || void 0 === this[s7] || this.C(s7, this[s7], i7);
    }
    let t5 = false;
    const s6 = this._$AL;
    try {
      t5 = this.shouldUpdate(s6), t5 ? (this.willUpdate(s6), (_a9 = this._$ES) == null ? void 0 : _a9.forEach((t6) => {
        var _a10;
        return (_a10 = t6.hostUpdate) == null ? void 0 : _a10.call(t6);
      }), this.update(s6)) : this._$ET();
    } catch (s7) {
      throw t5 = false, this._$ET(), s7;
    }
    t5 && this._$AE(s6);
  }
  willUpdate(t5) {
  }
  _$AE(t5) {
    var _a9;
    (_a9 = this._$ES) == null ? void 0 : _a9.forEach((t6) => {
      var _a10;
      return (_a10 = t6.hostUpdated) == null ? void 0 : _a10.call(t6);
    }), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(t5)), this.updated(t5);
  }
  _$ET() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = false;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$Eg;
  }
  shouldUpdate(t5) {
    return true;
  }
  update(t5) {
    this._$Ej && (this._$Ej = this._$Ej.forEach((t6) => this._$EO(t6, this[t6]))), this._$ET();
  }
  updated(t5) {
  }
  firstUpdated(t5) {
  }
};
var _a5;
b3.elementStyles = [], b3.shadowRootOptions = { mode: "open" }, b3[d3("elementProperties")] = /* @__PURE__ */ new Map(), b3[d3("finalized")] = /* @__PURE__ */ new Map(), p3 == null ? void 0 : p3({ ReactiveElement: b3 }), ((_a5 = a3.reactiveElementVersions) != null ? _a5 : a3.reactiveElementVersions = []).push("2.0.0");

// node_modules/lit/node_modules/lit-html/lit-html.js
var t4 = globalThis;
var i6 = t4.trustedTypes;
var s4 = i6 ? i6.createPolicy("lit-html", { createHTML: (t5) => t5 }) : void 0;
var e6 = "$lit$";
var h4 = `lit$${(Math.random() + "").slice(9)}$`;
var o6 = "?" + h4;
var n6 = `<${o6}>`;
var r6 = document;
var l4 = () => r6.createComment("");
var c6 = (t5) => null === t5 || "object" != typeof t5 && "function" != typeof t5;
var a4 = Array.isArray;
var u4 = (t5) => a4(t5) || "function" == typeof (t5 == null ? void 0 : t5[Symbol.iterator]);
var d4 = "[ 	\n\f\r]";
var f4 = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var v2 = /-->/g;
var _2 = />/g;
var m2 = RegExp(`>|${d4}(?:([^\\s"'>=/]+)(${d4}*=${d4}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var p4 = /'/g;
var g2 = /"/g;
var $2 = /^(?:script|style|textarea|title)$/i;
var w2 = Symbol.for("lit-noChange");
var T2 = Symbol.for("lit-nothing");
var A2 = /* @__PURE__ */ new WeakMap();
var E2 = r6.createTreeWalker(r6, 129);
function C2(t5, i7) {
  if (!Array.isArray(t5) || !t5.hasOwnProperty("raw"))
    throw Error("invalid template strings array");
  return void 0 !== s4 ? s4.createHTML(i7) : i7;
}
var P2 = (t5, i7) => {
  const s6 = t5.length - 1, o7 = [];
  let r8, l5 = 2 === i7 ? "<svg>" : "", c7 = f4;
  for (let i8 = 0; i8 < s6; i8++) {
    const s7 = t5[i8];
    let a5, u5, d5 = -1, y5 = 0;
    for (; y5 < s7.length && (c7.lastIndex = y5, u5 = c7.exec(s7), null !== u5); )
      y5 = c7.lastIndex, c7 === f4 ? "!--" === u5[1] ? c7 = v2 : void 0 !== u5[1] ? c7 = _2 : void 0 !== u5[2] ? ($2.test(u5[2]) && (r8 = RegExp("</" + u5[2], "g")), c7 = m2) : void 0 !== u5[3] && (c7 = m2) : c7 === m2 ? ">" === u5[0] ? (c7 = r8 != null ? r8 : f4, d5 = -1) : void 0 === u5[1] ? d5 = -2 : (d5 = c7.lastIndex - u5[2].length, a5 = u5[1], c7 = void 0 === u5[3] ? m2 : '"' === u5[3] ? g2 : p4) : c7 === g2 || c7 === p4 ? c7 = m2 : c7 === v2 || c7 === _2 ? c7 = f4 : (c7 = m2, r8 = void 0);
    const x3 = c7 === m2 && t5[i8 + 1].startsWith("/>") ? " " : "";
    l5 += c7 === f4 ? s7 + n6 : d5 >= 0 ? (o7.push(a5), s7.slice(0, d5) + e6 + s7.slice(d5) + h4 + x3) : s7 + h4 + (-2 === d5 ? i8 : x3);
  }
  return [C2(t5, l5 + (t5[s6] || "<?>") + (2 === i7 ? "</svg>" : "")), o7];
};
var V2 = class _V {
  constructor({ strings: t5, _$litType$: s6 }, n7) {
    let r8;
    this.parts = [];
    let c7 = 0, a5 = 0;
    const u5 = t5.length - 1, d5 = this.parts, [f5, v3] = P2(t5, s6);
    if (this.el = _V.createElement(f5, n7), E2.currentNode = this.el.content, 2 === s6) {
      const t6 = this.el.content.firstChild;
      t6.replaceWith(...t6.childNodes);
    }
    for (; null !== (r8 = E2.nextNode()) && d5.length < u5; ) {
      if (1 === r8.nodeType) {
        if (r8.hasAttributes())
          for (const t6 of r8.getAttributeNames())
            if (t6.endsWith(e6)) {
              const i7 = v3[a5++], s7 = r8.getAttribute(t6).split(h4), e7 = /([.?@])?(.*)/.exec(i7);
              d5.push({ type: 1, index: c7, name: e7[2], strings: s7, ctor: "." === e7[1] ? k2 : "?" === e7[1] ? H2 : "@" === e7[1] ? I2 : R2 }), r8.removeAttribute(t6);
            } else
              t6.startsWith(h4) && (d5.push({ type: 6, index: c7 }), r8.removeAttribute(t6));
        if ($2.test(r8.tagName)) {
          const t6 = r8.textContent.split(h4), s7 = t6.length - 1;
          if (s7 > 0) {
            r8.textContent = i6 ? i6.emptyScript : "";
            for (let i7 = 0; i7 < s7; i7++)
              r8.append(t6[i7], l4()), E2.nextNode(), d5.push({ type: 2, index: ++c7 });
            r8.append(t6[s7], l4());
          }
        }
      } else if (8 === r8.nodeType)
        if (r8.data === o6)
          d5.push({ type: 2, index: c7 });
        else {
          let t6 = -1;
          for (; -1 !== (t6 = r8.data.indexOf(h4, t6 + 1)); )
            d5.push({ type: 7, index: c7 }), t6 += h4.length - 1;
        }
      c7++;
    }
  }
  static createElement(t5, i7) {
    const s6 = r6.createElement("template");
    return s6.innerHTML = t5, s6;
  }
};
function N2(t5, i7, s6 = t5, e7) {
  var _a9, _b3, _c;
  if (i7 === w2)
    return i7;
  let h5 = void 0 !== e7 ? (_a9 = s6._$Co) == null ? void 0 : _a9[e7] : s6._$Cl;
  const o7 = c6(i7) ? void 0 : i7._$litDirective$;
  return (h5 == null ? void 0 : h5.constructor) !== o7 && ((_b3 = h5 == null ? void 0 : h5._$AO) == null ? void 0 : _b3.call(h5, false), void 0 === o7 ? h5 = void 0 : (h5 = new o7(t5), h5._$AT(t5, s6, e7)), void 0 !== e7 ? ((_c = s6._$Co) != null ? _c : s6._$Co = [])[e7] = h5 : s6._$Cl = h5), void 0 !== h5 && (i7 = N2(t5, h5._$AS(t5, i7.values), h5, e7)), i7;
}
var S4 = class {
  constructor(t5, i7) {
    this._$AV = [], this._$AN = void 0, this._$AD = t5, this._$AM = i7;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t5) {
    var _a9;
    const { el: { content: i7 }, parts: s6 } = this._$AD, e7 = ((_a9 = t5 == null ? void 0 : t5.creationScope) != null ? _a9 : r6).importNode(i7, true);
    E2.currentNode = e7;
    let h5 = E2.nextNode(), o7 = 0, n7 = 0, l5 = s6[0];
    for (; void 0 !== l5; ) {
      if (o7 === l5.index) {
        let i8;
        2 === l5.type ? i8 = new M2(h5, h5.nextSibling, this, t5) : 1 === l5.type ? i8 = new l5.ctor(h5, l5.name, l5.strings, this, t5) : 6 === l5.type && (i8 = new L2(h5, this, t5)), this._$AV.push(i8), l5 = s6[++n7];
      }
      o7 !== (l5 == null ? void 0 : l5.index) && (h5 = E2.nextNode(), o7++);
    }
    return E2.currentNode = r6, e7;
  }
  p(t5) {
    let i7 = 0;
    for (const s6 of this._$AV)
      void 0 !== s6 && (void 0 !== s6.strings ? (s6._$AI(t5, s6, i7), i7 += s6.strings.length - 2) : s6._$AI(t5[i7])), i7++;
  }
};
var M2 = class _M {
  get _$AU() {
    var _a9, _b3;
    return (_b3 = (_a9 = this._$AM) == null ? void 0 : _a9._$AU) != null ? _b3 : this._$Cv;
  }
  constructor(t5, i7, s6, e7) {
    var _a9;
    this.type = 2, this._$AH = T2, this._$AN = void 0, this._$AA = t5, this._$AB = i7, this._$AM = s6, this.options = e7, this._$Cv = (_a9 = e7 == null ? void 0 : e7.isConnected) != null ? _a9 : true;
  }
  get parentNode() {
    let t5 = this._$AA.parentNode;
    const i7 = this._$AM;
    return void 0 !== i7 && 11 === (t5 == null ? void 0 : t5.nodeType) && (t5 = i7.parentNode), t5;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t5, i7 = this) {
    t5 = N2(this, t5, i7), c6(t5) ? t5 === T2 || null == t5 || "" === t5 ? (this._$AH !== T2 && this._$AR(), this._$AH = T2) : t5 !== this._$AH && t5 !== w2 && this._(t5) : void 0 !== t5._$litType$ ? this.g(t5) : void 0 !== t5.nodeType ? this.$(t5) : u4(t5) ? this.T(t5) : this._(t5);
  }
  k(t5) {
    return this._$AA.parentNode.insertBefore(t5, this._$AB);
  }
  $(t5) {
    this._$AH !== t5 && (this._$AR(), this._$AH = this.k(t5));
  }
  _(t5) {
    this._$AH !== T2 && c6(this._$AH) ? this._$AA.nextSibling.data = t5 : this.$(r6.createTextNode(t5)), this._$AH = t5;
  }
  g(t5) {
    var _a9;
    const { values: i7, _$litType$: s6 } = t5, e7 = "number" == typeof s6 ? this._$AC(t5) : (void 0 === s6.el && (s6.el = V2.createElement(C2(s6.h, s6.h[0]), this.options)), s6);
    if (((_a9 = this._$AH) == null ? void 0 : _a9._$AD) === e7)
      this._$AH.p(i7);
    else {
      const t6 = new S4(e7, this), s7 = t6.u(this.options);
      t6.p(i7), this.$(s7), this._$AH = t6;
    }
  }
  _$AC(t5) {
    let i7 = A2.get(t5.strings);
    return void 0 === i7 && A2.set(t5.strings, i7 = new V2(t5)), i7;
  }
  T(t5) {
    a4(this._$AH) || (this._$AH = [], this._$AR());
    const i7 = this._$AH;
    let s6, e7 = 0;
    for (const h5 of t5)
      e7 === i7.length ? i7.push(s6 = new _M(this.k(l4()), this.k(l4()), this, this.options)) : s6 = i7[e7], s6._$AI(h5), e7++;
    e7 < i7.length && (this._$AR(s6 && s6._$AB.nextSibling, e7), i7.length = e7);
  }
  _$AR(t5 = this._$AA.nextSibling, i7) {
    var _a9;
    for ((_a9 = this._$AP) == null ? void 0 : _a9.call(this, false, true, i7); t5 && t5 !== this._$AB; ) {
      const i8 = t5.nextSibling;
      t5.remove(), t5 = i8;
    }
  }
  setConnected(t5) {
    var _a9;
    void 0 === this._$AM && (this._$Cv = t5, (_a9 = this._$AP) == null ? void 0 : _a9.call(this, t5));
  }
};
var R2 = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t5, i7, s6, e7, h5) {
    this.type = 1, this._$AH = T2, this._$AN = void 0, this.element = t5, this.name = i7, this._$AM = e7, this.options = h5, s6.length > 2 || "" !== s6[0] || "" !== s6[1] ? (this._$AH = Array(s6.length - 1).fill(new String()), this.strings = s6) : this._$AH = T2;
  }
  _$AI(t5, i7 = this, s6, e7) {
    const h5 = this.strings;
    let o7 = false;
    if (void 0 === h5)
      t5 = N2(this, t5, i7, 0), o7 = !c6(t5) || t5 !== this._$AH && t5 !== w2, o7 && (this._$AH = t5);
    else {
      const e8 = t5;
      let n7, r8;
      for (t5 = h5[0], n7 = 0; n7 < h5.length - 1; n7++)
        r8 = N2(this, e8[s6 + n7], i7, n7), r8 === w2 && (r8 = this._$AH[n7]), o7 || (o7 = !c6(r8) || r8 !== this._$AH[n7]), r8 === T2 ? t5 = T2 : t5 !== T2 && (t5 += (r8 != null ? r8 : "") + h5[n7 + 1]), this._$AH[n7] = r8;
    }
    o7 && !e7 && this.j(t5);
  }
  j(t5) {
    t5 === T2 ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t5 != null ? t5 : "");
  }
};
var k2 = class extends R2 {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t5) {
    this.element[this.name] = t5 === T2 ? void 0 : t5;
  }
};
var H2 = class extends R2 {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t5) {
    this.element.toggleAttribute(this.name, !!t5 && t5 !== T2);
  }
};
var I2 = class extends R2 {
  constructor(t5, i7, s6, e7, h5) {
    super(t5, i7, s6, e7, h5), this.type = 5;
  }
  _$AI(t5, i7 = this) {
    var _a9;
    if ((t5 = (_a9 = N2(this, t5, i7, 0)) != null ? _a9 : T2) === w2)
      return;
    const s6 = this._$AH, e7 = t5 === T2 && s6 !== T2 || t5.capture !== s6.capture || t5.once !== s6.once || t5.passive !== s6.passive, h5 = t5 !== T2 && (s6 === T2 || e7);
    e7 && this.element.removeEventListener(this.name, this, s6), h5 && this.element.addEventListener(this.name, this, t5), this._$AH = t5;
  }
  handleEvent(t5) {
    var _a9, _b3;
    "function" == typeof this._$AH ? this._$AH.call((_b3 = (_a9 = this.options) == null ? void 0 : _a9.host) != null ? _b3 : this.element, t5) : this._$AH.handleEvent(t5);
  }
};
var L2 = class {
  constructor(t5, i7, s6) {
    this.element = t5, this.type = 6, this._$AN = void 0, this._$AM = i7, this.options = s6;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t5) {
    N2(this, t5);
  }
};
var Z2 = t4.litHtmlPolyfillSupport;
var _a6;
Z2 == null ? void 0 : Z2(V2, M2), ((_a6 = t4.litHtmlVersions) != null ? _a6 : t4.litHtmlVersions = []).push("3.0.0");

// node_modules/lit-element/lit-element.js
var s5 = class extends b {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    var _a9, _b3;
    const t5 = super.createRenderRoot();
    return (_b3 = (_a9 = this.renderOptions).renderBefore) != null ? _b3 : _a9.renderBefore = t5.firstChild, t5;
  }
  update(t5) {
    const i7 = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t5), this._$Do = j(i7, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    var _a9;
    super.connectedCallback(), (_a9 = this._$Do) == null ? void 0 : _a9.setConnected(true);
  }
  disconnectedCallback() {
    var _a9;
    super.disconnectedCallback(), (_a9 = this._$Do) == null ? void 0 : _a9.setConnected(false);
  }
  render() {
    return w;
  }
};
var _a7;
s5._$litElement$ = true, s5["finalized"] = true, (_a7 = globalThis.litElementHydrateSupport) == null ? void 0 : _a7.call(globalThis, { LitElement: s5 });
var r7 = globalThis.litElementPolyfillSupport;
r7 == null ? void 0 : r7({ LitElement: s5 });
var _a8;
((_a8 = globalThis.litElementVersions) != null ? _a8 : globalThis.litElementVersions = []).push("4.0.0");
/*! Bundled license information:

@lit/reactive-element/css-tag.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/reactive-element.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/lit-html.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/css-tag.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/reactive-element.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/lit-html.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-element/lit-element.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/is-server.js:
  (**
   * @license
   * Copyright 2022 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/

// src/styles/component.styles.ts
var component_styles_default = i$1`
  :host {
    box-sizing: border-box;
  }

  :host *,
  :host *::before,
  :host *::after {
    box-sizing: inherit;
  }

  [hidden] {
    display: none !important;
  }
`;

// src/components/carousel/carousel.styles.ts
var carousel_styles_default = i$1`
  ${component_styles_default}

  :host {
    --slide-gap: var(--sl-spacing-medium, 1rem);
    --aspect-ratio: 16 / 9;
    --scroll-hint: 0px;

    display: flex;
  }

  .carousel {
    display: grid;
    grid-template-columns: min-content 1fr min-content;
    grid-template-rows: 1fr min-content;
    grid-template-areas:
      '. slides .'
      '. pagination .';
    gap: var(--sl-spacing-medium);
    align-items: center;
    min-height: 100%;
    min-width: 100%;
    position: relative;
  }

  .carousel__pagination {
    grid-area: pagination;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--sl-spacing-small);
  }

  .carousel__slides {
    grid-area: slides;

    display: grid;
    height: 100%;
    width: 100%;
    align-items: center;
    justify-items: center;
    overflow: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    aspect-ratio: calc(var(--aspect-ratio) * var(--slides-per-page));
    border-radius: var(--sl-border-radius-small);

    --slide-size: calc((100% - (var(--slides-per-page) - 1) * var(--slide-gap)) / var(--slides-per-page));
  }

  @media (prefers-reduced-motion) {
    :where(.carousel__slides) {
      scroll-behavior: auto;
    }
  }

  .carousel__slides--horizontal {
    grid-auto-flow: column;
    grid-auto-columns: var(--slide-size);
    grid-auto-rows: 100%;
    column-gap: var(--slide-gap);
    scroll-snap-type: x mandatory;
    scroll-padding-inline: var(--scroll-hint);
    padding-inline: var(--scroll-hint);
    overflow-y: hidden;
  }

  .carousel__slides--vertical {
    grid-auto-flow: row;
    grid-auto-columns: 100%;
    grid-auto-rows: var(--slide-size);
    row-gap: var(--slide-gap);
    scroll-snap-type: y mandatory;
    scroll-padding-block: var(--scroll-hint);
    padding-block: var(--scroll-hint);
    overflow-x: hidden;
  }

  .carousel__slides--dragging,
  .carousel__slides--dropping {
    scroll-snap-type: unset;
  }

  :host([vertical]) ::slotted(sl-carousel-item) {
    height: 100%;
  }

  .carousel__slides::-webkit-scrollbar {
    display: none;
  }

  .carousel__navigation {
    grid-area: navigation;
    display: contents;
    font-size: var(--sl-font-size-x-large);
  }

  .carousel__navigation-button {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    background: none;
    border: none;
    border-radius: var(--sl-border-radius-small);
    font-size: inherit;
    color: var(--sl-color-neutral-600);
    padding: var(--sl-spacing-x-small);
    cursor: pointer;
    transition: var(--sl-transition-medium) color;
    appearance: none;
  }

  .carousel__navigation-button--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .carousel__navigation-button--disabled::part(base) {
    pointer-events: none;
  }

  .carousel__navigation-button--previous {
    grid-column: 1;
    grid-row: 1;
  }

  .carousel__navigation-button--next {
    grid-column: 3;
    grid-row: 1;
  }

  .carousel__pagination-item {
    display: block;
    cursor: pointer;
    background: none;
    border: 0;
    border-radius: var(--sl-border-radius-circle);
    width: var(--sl-spacing-small);
    height: var(--sl-spacing-small);
    background-color: var(--sl-color-neutral-300);
    padding: 0;
    margin: 0;
  }

  .carousel__pagination-item--active {
    background-color: var(--sl-color-neutral-700);
    transform: scale(1.2);
  }

  /* Focus styles */
  .carousel__slides:focus-visible,
  .carousel__navigation-button:focus-visible,
  .carousel__pagination-item:focus-visible {
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }
`;

// src/internal/event.ts
function waitForEvent(el, eventName) {
  return new Promise((resolve) => {
    function done(event) {
      if (event.target === el) {
        el.removeEventListener(eventName, done);
        resolve();
      }
    }
    el.addEventListener(eventName, done);
  });
}

var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result)
    __defProp(target, key, result);
  return result;
};

function prefersReducedMotion() {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  return query.matches;
}

// src/components/carousel/scroll-controller.ts
var ScrollController = class {
  constructor(host) {
    this.dragging = false;
    this.scrolling = false;
    this.mouseDragging = false;
    this.handleScroll = () => {
      if (!this.scrolling) {
        this.scrolling = true;
        this.host.requestUpdate();
      }
    };
    this.handleScrollEnd = () => {
      if (this.scrolling && !this.dragging) {
        this.scrolling = false;
        this.host.requestUpdate();
      }
    };
    this.handlePointerDown = (event) => {
      if (event.pointerType === "touch") {
        return;
      }
      const canDrag = this.mouseDragging && event.button === 0;
      if (canDrag) {
        event.preventDefault();
        this.host.scrollContainer.addEventListener("pointermove", this.handlePointerMove);
      }
    };
    this.handlePointerMove = (event) => {
      const scrollContainer = this.host.scrollContainer;
      const hasMoved = !!event.movementX || !!event.movementY;
      if (!this.dragging && hasMoved) {
        scrollContainer.setPointerCapture(event.pointerId);
        this.handleDragStart();
      } else if (scrollContainer.hasPointerCapture(event.pointerId)) {
        this.handleDrag(event);
      }
    };
    this.handlePointerUp = (event) => {
      this.host.scrollContainer.releasePointerCapture(event.pointerId);
      this.handleDragEnd();
    };
    this.host = host;
    host.addController(this);
  }
  async hostConnected() {
    const host = this.host;
    await host.updateComplete;
    const scrollContainer = host.scrollContainer;
    scrollContainer.addEventListener("scroll", this.handleScroll, { passive: true });
    scrollContainer.addEventListener("scrollend", this.handleScrollEnd, true);
    scrollContainer.addEventListener("pointerdown", this.handlePointerDown);
    scrollContainer.addEventListener("pointerup", this.handlePointerUp);
    scrollContainer.addEventListener("pointercancel", this.handlePointerUp);
  }
  hostDisconnected() {
    const host = this.host;
    const scrollContainer = host.scrollContainer;
    scrollContainer.removeEventListener("scroll", this.handleScroll);
    scrollContainer.removeEventListener("scrollend", this.handleScrollEnd, true);
    scrollContainer.removeEventListener("pointerdown", this.handlePointerDown);
    scrollContainer.removeEventListener("pointerup", this.handlePointerUp);
    scrollContainer.removeEventListener("pointercancel", this.handlePointerUp);
  }
  handleDragStart() {
    const host = this.host;
    this.dragging = true;
    host.scrollContainer.style.setProperty("scroll-snap-type", "unset");
    host.requestUpdate();
  }
  handleDrag(event) {
    this.host.scrollContainer.scrollBy({
      left: -event.movementX,
      top: -event.movementY
    });
  }
  handleDragEnd() {
    const host = this.host;
    const scrollContainer = host.scrollContainer;
    scrollContainer.removeEventListener("pointermove", this.handlePointerMove);
    const startLeft = scrollContainer.scrollLeft;
    const startTop = scrollContainer.scrollTop;
    scrollContainer.style.removeProperty("scroll-snap-type");
    const finalLeft = scrollContainer.scrollLeft;
    const finalTop = scrollContainer.scrollTop;
    scrollContainer.style.setProperty("scroll-snap-type", "unset");
    scrollContainer.scrollTo({ left: startLeft, top: startTop, behavior: "auto" });
    scrollContainer.scrollTo({ left: finalLeft, top: finalTop, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    requestAnimationFrame(async () => {
      if (startLeft !== finalLeft || startTop !== finalTop) {
        await waitForEvent(scrollContainer, "scrollend");
      }
      scrollContainer.style.removeProperty("scroll-snap-type");
      this.dragging = false;
      host.requestUpdate();
    });
  }
};

// node_modules/@shoelace-style/localize/dist/index.js
var connectedElements = /* @__PURE__ */ new Set();
var documentElementObserver = new MutationObserver(update);
var translations = /* @__PURE__ */ new Map();
var documentDirection = document.documentElement.dir || "ltr";
var documentLanguage = document.documentElement.lang || navigator.language;
var fallback;
documentElementObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["dir", "lang"]
});
function registerTranslation(...translation) {
  translation.map((t) => {
    const code = t.$code.toLowerCase();
    if (translations.has(code)) {
      translations.set(code, Object.assign(Object.assign({}, translations.get(code)), t));
    } else {
      translations.set(code, t);
    }
    if (!fallback) {
      fallback = t;
    }
  });
  update();
}
function update() {
  documentDirection = document.documentElement.dir || "ltr";
  documentLanguage = document.documentElement.lang || navigator.language;
  [...connectedElements.keys()].map((el) => {
    if (typeof el.requestUpdate === "function") {
      el.requestUpdate();
    }
  });
}
var LocalizeController = class {
  constructor(host) {
    this.host = host;
    this.host.addController(this);
  }
  hostConnected() {
    connectedElements.add(this.host);
  }
  hostDisconnected() {
    connectedElements.delete(this.host);
  }
  dir() {
    return `${this.host.dir || documentDirection}`.toLowerCase();
  }
  lang() {
    return `${this.host.lang || documentLanguage}`.toLowerCase();
  }
  getTranslationData(lang) {
    var _a, _b;
    const locale = new Intl.Locale(lang.replace(/_/g, "-"));
    const language = locale === null || locale === void 0 ? void 0 : locale.language.toLowerCase();
    const region = (_b = (_a = locale === null || locale === void 0 ? void 0 : locale.region) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : "";
    const primary = translations.get(`${language}-${region}`);
    const secondary = translations.get(language);
    return { locale, language, region, primary, secondary };
  }
  exists(key, options) {
    var _a;
    const { primary, secondary } = this.getTranslationData((_a = options.lang) !== null && _a !== void 0 ? _a : this.lang());
    options = Object.assign({ includeFallback: false }, options);
    if (primary && primary[key] || secondary && secondary[key] || options.includeFallback && fallback && fallback[key]) {
      return true;
    }
    return false;
  }
  term(key, ...args) {
    const { primary, secondary } = this.getTranslationData(this.lang());
    let term;
    if (primary && primary[key]) {
      term = primary[key];
    } else if (secondary && secondary[key]) {
      term = secondary[key];
    } else if (fallback && fallback[key]) {
      term = fallback[key];
    } else {
      console.error(`No translation found for: ${String(key)}`);
      return String(key);
    }
    if (typeof term === "function") {
      return term(...args);
    }
    return term;
  }
  date(dateToFormat, options) {
    dateToFormat = new Date(dateToFormat);
    return new Intl.DateTimeFormat(this.lang(), options).format(dateToFormat);
  }
  number(numberToFormat, options) {
    numberToFormat = Number(numberToFormat);
    return isNaN(numberToFormat) ? "" : new Intl.NumberFormat(this.lang(), options).format(numberToFormat);
  }
  relativeTime(value, unit, options) {
    return new Intl.RelativeTimeFormat(this.lang(), options).format(value, unit);
  }
};

// src/translations/en.ts
var translation = {
  $code: "en",
  $name: "English",
  $dir: "ltr",
  carousel: "Carousel",
  clearEntry: "Clear entry",
  close: "Close",
  copied: "Copied",
  copy: "Copy",
  currentValue: "Current value",
  error: "Error",
  goToSlide: (slide, count) => `Go to slide ${slide} of ${count}`,
  hidePassword: "Hide password",
  loading: "Loading",
  nextSlide: "Next slide",
  numOptionsSelected: (num) => {
    if (num === 0)
      return "No options selected";
    if (num === 1)
      return "1 option selected";
    return `${num} options selected`;
  },
  previousSlide: "Previous slide",
  progress: "Progress",
  remove: "Remove",
  resize: "Resize",
  scrollToEnd: "Scroll to end",
  scrollToStart: "Scroll to start",
  selectAColorFromTheScreen: "Select a color from the screen",
  showPassword: "Show password",
  slideNum: (slide) => `Slide ${slide}`,
  toggleColorFormat: "Toggle color format"
};
registerTranslation(translation);
var en_default = translation;

// src/utilities/localize.ts
var LocalizeController2 = class extends LocalizeController {
};
registerTranslation(en_default);

// node_modules/lit/node_modules/lit-html/directive.js
var t = { ATTRIBUTE: 1, CHILD: 2, PROPERTY: 3, BOOLEAN_ATTRIBUTE: 4, EVENT: 5, ELEMENT: 6 };
var e$2 = (t2) => (...e2) => ({ _$litDirective$: t2, values: e2 });
var i = class {
  constructor(t2) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(t2, e2, i2) {
    this._$Ct = t2, this._$AM = e2, this._$Ci = i2;
  }
  _$AS(t2, e2) {
    return this.update(t2, e2);
  }
  update(t2, e2) {
    return this.render(...e2);
  }
};
/*! Bundled license information:

lit-html/directive.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/

// node_modules/lit/node_modules/lit-html/directives/class-map.js
var e2$1 = e$2(class extends i {
  constructor(t2) {
    var _a;
    if (super(t2), t2.type !== t.ATTRIBUTE || "class" !== t2.name || ((_a = t2.strings) == null ? void 0 : _a.length) > 2)
      throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.");
  }
  render(t2) {
    return " " + Object.keys(t2).filter((s) => t2[s]).join(" ") + " ";
  }
  update(s, [i2]) {
    var _a, _b;
    if (void 0 === this.it) {
      this.it = /* @__PURE__ */ new Set(), void 0 !== s.strings && (this.st = new Set(s.strings.join(" ").split(/\s/).filter((t2) => "" !== t2)));
      for (const t2 in i2)
        i2[t2] && !((_a = this.st) == null ? void 0 : _a.has(t2)) && this.it.add(t2);
      return this.render(i2);
    }
    const r = s.element.classList;
    for (const t2 of this.it)
      t2 in i2 || (r.remove(t2), this.it.delete(t2));
    for (const t2 in i2) {
      const s2 = !!i2[t2];
      s2 === this.it.has(t2) || ((_b = this.st) == null ? void 0 : _b.has(t2)) || (s2 ? (r.add(t2), this.it.add(t2)) : (r.remove(t2), this.it.delete(t2)));
    }
    return w2;
  }
});
/*! Bundled license information:

lit-html/directives/class-map.js:
  (**
   * @license
   * Copyright 2018 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/

var e$1 = (o, t2) => void 0 === t2 ? void 0 !== (o == null ? void 0 : o._$litType$) : (o == null ? void 0 : o._$litType$) === t2;
/*! Bundled license information:

lit-html/directive-helpers.js:
  (**
   * @license
   * Copyright 2020 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/

// src/components/icon/icon.styles.ts
var icon_styles_default = i$1`
  ${component_styles_default}

  :host {
    display: inline-block;
    width: 1em;
    height: 1em;
    box-sizing: content-box !important;
  }

  svg {
    display: block;
    height: 100%;
    width: 100%;
  }
`;

// src/utilities/base-path.ts
var basePath = "";
function setBasePath(path) {
  basePath = path;
}
function getBasePath(subpath = "") {
  if (!basePath) {
    const scripts = [...document.getElementsByTagName("script")];
    const configScript = scripts.find((script) => script.hasAttribute("data-shoelace"));
    if (configScript) {
      setBasePath(configScript.getAttribute("data-shoelace"));
    } else {
      const fallbackScript = scripts.find((s) => {
        return /shoelace(\.min)?\.js($|\?)/.test(s.src) || /shoelace-autoloader(\.min)?\.js($|\?)/.test(s.src);
      });
      let path = "";
      if (fallbackScript) {
        path = fallbackScript.getAttribute("src");
      }
      setBasePath(path.split("/").slice(0, -1).join("/"));
    }
  }
  return basePath.replace(/\/$/, "") + (subpath ? `/${subpath.replace(/^\//, "")}` : ``);
}

// src/components/icon/library.default.ts
var library = {
  name: "default",
  resolver: (name) => getBasePath(`assets/icons/${name}.svg`)
};
var library_default_default = library;

// src/components/icon/library.system.ts
var icons = {
  caret: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `,
  check: `
    <svg part="checked-icon" class="checkbox__icon" viewBox="0 0 16 16">
      <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-linecap="round">
        <g stroke="currentColor">
          <g transform="translate(3.428571, 3.428571)">
            <path d="M0,5.71428571 L3.42857143,9.14285714"></path>
            <path d="M9.14285714,0 L3.42857143,9.14285714"></path>
          </g>
        </g>
      </g>
    </svg>
  `,
  "chevron-down": `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-down" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
    </svg>
  `,
  "chevron-left": `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-left" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
    </svg>
  `,
  "chevron-right": `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
    </svg>
  `,
  copy: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-copy" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6ZM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2Z"/>
    </svg>
  `,
  eye: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye" viewBox="0 0 16 16">
      <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
      <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
    </svg>
  `,
  "eye-slash": `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye-slash" viewBox="0 0 16 16">
      <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
      <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
      <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
    </svg>
  `,
  eyedropper: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eyedropper" viewBox="0 0 16 16">
      <path d="M13.354.646a1.207 1.207 0 0 0-1.708 0L8.5 3.793l-.646-.647a.5.5 0 1 0-.708.708L8.293 5l-7.147 7.146A.5.5 0 0 0 1 12.5v1.793l-.854.853a.5.5 0 1 0 .708.707L1.707 15H3.5a.5.5 0 0 0 .354-.146L11 7.707l1.146 1.147a.5.5 0 0 0 .708-.708l-.647-.646 3.147-3.146a1.207 1.207 0 0 0 0-1.708l-2-2zM2 12.707l7-7L10.293 7l-7 7H2v-1.293z"></path>
    </svg>
  `,
  "grip-vertical": `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical" viewBox="0 0 16 16">
      <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"></path>
    </svg>
  `,
  indeterminate: `
    <svg part="indeterminate-icon" class="checkbox__icon" viewBox="0 0 16 16">
      <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-linecap="round">
        <g stroke="currentColor" stroke-width="2">
          <g transform="translate(2.285714, 6.857143)">
            <path d="M10.2857143,1.14285714 L1.14285714,1.14285714"></path>
          </g>
        </g>
      </g>
    </svg>
  `,
  "person-fill": `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-person-fill" viewBox="0 0 16 16">
      <path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
    </svg>
  `,
  "play-fill": `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
      <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"></path>
    </svg>
  `,
  "pause-fill": `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pause-fill" viewBox="0 0 16 16">
      <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"></path>
    </svg>
  `,
  radio: `
    <svg part="checked-icon" class="radio__icon" viewBox="0 0 16 16">
      <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <g fill="currentColor">
          <circle cx="8" cy="8" r="3.42857143"></circle>
        </g>
      </g>
    </svg>
  `,
  "star-fill": `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-star-fill" viewBox="0 0 16 16">
      <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
    </svg>
  `,
  "x-lg": `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-lg" viewBox="0 0 16 16">
      <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
    </svg>
  `,
  "x-circle-fill": `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle-fill" viewBox="0 0 16 16">
      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"></path>
    </svg>
  `
};
var systemLibrary = {
  name: "system",
  resolver: (name) => {
    if (name in icons) {
      return `data:image/svg+xml,${encodeURIComponent(icons[name])}`;
    }
    return "";
  }
};
var library_system_default = systemLibrary;

// src/components/icon/library.ts
var registry = [library_default_default, library_system_default];
var watchedIcons = [];
function watchIcon(icon) {
  watchedIcons.push(icon);
}
function unwatchIcon(icon) {
  watchedIcons = watchedIcons.filter((el) => el !== icon);
}
function getIconLibrary(name) {
  return registry.find((lib) => lib.name === name);
}

// src/internal/watch.ts
function watch(propertyName, options) {
  const resolvedOptions = __spreadValues({
    waitUntilFirstUpdate: false
  }, options);
  return (proto, decoratedFnName) => {
    const { update } = proto;
    const watchedProperties = Array.isArray(propertyName) ? propertyName : [propertyName];
    proto.update = function(changedProps) {
      watchedProperties.forEach((property) => {
        const key = property;
        if (changedProps.has(key)) {
          const oldValue = changedProps.get(key);
          const newValue = this[key];
          if (oldValue !== newValue) {
            if (!resolvedOptions.waitUntilFirstUpdate || this.hasUpdated) {
              this[decoratedFnName](oldValue, newValue);
            }
          }
        }
      });
      update.call(this, changedProps);
    };
  };
}

// node_modules/lit/node_modules/@lit/reactive-element/decorators/property.js
var o$1 = { attribute: true, type: String, converter: u3, reflect: false, hasChanged: f3 };
var r = (t2 = o$1, e3, r4) => {
  const { kind: n2, metadata: i } = r4;
  let s2 = globalThis.litPropertyMetadata.get(i);
  if (void 0 === s2 && globalThis.litPropertyMetadata.set(i, s2 = /* @__PURE__ */ new Map()), s2.set(r4.name, t2), "accessor" === n2) {
    const { name: o2 } = r4;
    return { set(r5) {
      const n3 = e3.get.call(this);
      e3.set.call(this, r5), this.requestUpdate(o2, n3, t2);
    }, init(e4) {
      return void 0 !== e4 && this.C(o2, void 0, t2), e4;
    } };
  }
  if ("setter" === n2) {
    const { name: o2 } = r4;
    return function(r5) {
      const n3 = this[o2];
      e3.call(this, r5), this.requestUpdate(o2, n3, t2);
    };
  }
  throw Error("Unsupported decorator location: " + n2);
};
function n(t2) {
  return (e3, o2) => "object" == typeof o2 ? r(t2, e3, o2) : ((t3, e4, o3) => {
    const r4 = e4.hasOwnProperty(o3);
    return e4.constructor.createProperty(o3, r4 ? __spreadProps(__spreadValues({}, t3), { wrapped: true }) : t3), r4 ? Object.getOwnPropertyDescriptor(e4, o3) : void 0;
  })(t2, e3, o2);
}

// node_modules/lit/node_modules/@lit/reactive-element/decorators/state.js
function r2(r4) {
  return n(__spreadProps(__spreadValues({}, r4), { state: true, attribute: false }));
}

// node_modules/lit/node_modules/@lit/reactive-element/decorators/base.js
var e = (e3, t2, c) => (c.configurable = true, c.enumerable = true, Reflect.decorate && "object" != typeof t2 && Object.defineProperty(e3, t2, c), c);

// node_modules/lit/node_modules/@lit/reactive-element/decorators/query.js
function e2(e3, r4) {
  return (n2, s2, i) => {
    const o2 = (t2) => {
      var _a, _b;
      return (_b = (_a = t2.renderRoot) == null ? void 0 : _a.querySelector(e3)) != null ? _b : null;
    };
    if (r4) {
      const { get: e4, set: u2 } = "object" == typeof s2 ? n2 : i != null ? i : (() => {
        const t2 = Symbol();
        return { get() {
          return this[t2];
        }, set(e5) {
          this[t2] = e5;
        } };
      })();
      return e(n2, s2, { get() {
        if (r4) {
          let t2 = e4.call(this);
          return void 0 === t2 && (t2 = o2(this), u2.call(this, t2)), t2;
        }
        return o2(this);
      } });
    }
    return e(n2, s2, { get() {
      return o2(this);
    } });
  };
}

// src/internal/shoelace-element.ts
var ShoelaceElement = class extends s5 {
  constructor() {
    super();
    Object.entries(this.constructor.dependencies).forEach(([name, component]) => {
      this.constructor.define(name, component);
    });
  }
  emit(name, options) {
    const event = new CustomEvent(name, __spreadValues({
      bubbles: true,
      cancelable: false,
      composed: true,
      detail: {}
    }, options));
    this.dispatchEvent(event);
    return event;
  }
  /* eslint-enable */
  static define(name, elementConstructor = this, options = {}) {
    const currentlyRegisteredConstructor = customElements.get(name);
    if (!currentlyRegisteredConstructor) {
      customElements.define(name, class extends elementConstructor {
      }, options);
      return;
    }
    let newVersion = " (unknown version)";
    let existingVersion = newVersion;
    if ("version" in elementConstructor && elementConstructor.version) {
      newVersion = " v" + elementConstructor.version;
    }
    if ("version" in currentlyRegisteredConstructor && currentlyRegisteredConstructor.version) {
      existingVersion = " v" + currentlyRegisteredConstructor.version;
    }
    if (newVersion && existingVersion && newVersion === existingVersion) {
      return;
    }
    console.warn(
      `Attempted to register <${name}>${newVersion}, but <${name}>${existingVersion} has already been registered.`
    );
  }
};
/* eslint-disable */
// @ts-expect-error This is auto-injected at build time.
ShoelaceElement.version = "2.12.0";
ShoelaceElement.dependencies = {};
__decorateClass([
  n()
], ShoelaceElement.prototype, "dir", 2);
__decorateClass([
  n()
], ShoelaceElement.prototype, "lang", 2);
/*! Bundled license information:

@lit/reactive-element/decorators/property.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/state.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/event-options.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/base.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-async.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/custom-element.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-all.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-assigned-elements.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-assigned-nodes.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/

// src/components/icon/icon.component.ts
var CACHEABLE_ERROR = Symbol();
var RETRYABLE_ERROR = Symbol();
var parser;
var iconCache = /* @__PURE__ */ new Map();
var SlIcon = class extends ShoelaceElement {
  constructor() {
    super(...arguments);
    this.initialRender = false;
    this.svg = null;
    this.label = "";
    this.library = "default";
  }
  /** Given a URL, this function returns the resulting SVG element or an appropriate error symbol. */
  async resolveIcon(url, library) {
    var _a;
    let fileData;
    if (library == null ? void 0 : library.spriteSheet) {
      return x`<svg part="svg">
        <use part="use" href="${url}"></use>
      </svg>`;
    }
    try {
      fileData = await fetch(url, { mode: "cors" });
      if (!fileData.ok)
        return fileData.status === 410 ? CACHEABLE_ERROR : RETRYABLE_ERROR;
    } catch (e2) {
      return RETRYABLE_ERROR;
    }
    try {
      const div = document.createElement("div");
      div.innerHTML = await fileData.text();
      const svg = div.firstElementChild;
      if (((_a = svg == null ? void 0 : svg.tagName) == null ? void 0 : _a.toLowerCase()) !== "svg")
        return CACHEABLE_ERROR;
      if (!parser)
        parser = new DOMParser();
      const doc = parser.parseFromString(svg.outerHTML, "text/html");
      const svgEl = doc.body.querySelector("svg");
      if (!svgEl)
        return CACHEABLE_ERROR;
      svgEl.part.add("svg");
      return document.adoptNode(svgEl);
    } catch (e2) {
      return CACHEABLE_ERROR;
    }
  }
  connectedCallback() {
    super.connectedCallback();
    watchIcon(this);
  }
  firstUpdated() {
    this.initialRender = true;
    this.setIcon();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    unwatchIcon(this);
  }
  getIconSource() {
    const library = getIconLibrary(this.library);
    if (this.name && library) {
      return {
        url: library.resolver(this.name),
        fromLibrary: true
      };
    }
    return {
      url: this.src,
      fromLibrary: false
    };
  }
  handleLabelChange() {
    const hasLabel = typeof this.label === "string" && this.label.length > 0;
    if (hasLabel) {
      this.setAttribute("role", "img");
      this.setAttribute("aria-label", this.label);
      this.removeAttribute("aria-hidden");
    } else {
      this.removeAttribute("role");
      this.removeAttribute("aria-label");
      this.setAttribute("aria-hidden", "true");
    }
  }
  async setIcon() {
    var _a;
    const { url, fromLibrary } = this.getIconSource();
    const library = fromLibrary ? getIconLibrary(this.library) : void 0;
    if (!url) {
      this.svg = null;
      return;
    }
    let iconResolver = iconCache.get(url);
    if (!iconResolver) {
      iconResolver = this.resolveIcon(url, library);
      iconCache.set(url, iconResolver);
    }
    if (!this.initialRender) {
      return;
    }
    const svg = await iconResolver;
    if (svg === RETRYABLE_ERROR) {
      iconCache.delete(url);
    }
    if (url !== this.getIconSource().url) {
      return;
    }
    if (e$1(svg)) {
      this.svg = svg;
      return;
    }
    switch (svg) {
      case RETRYABLE_ERROR:
      case CACHEABLE_ERROR:
        this.svg = null;
        this.emit("sl-error");
        break;
      default:
        this.svg = svg.cloneNode(true);
        (_a = library == null ? void 0 : library.mutator) == null ? void 0 : _a.call(library, this.svg);
        this.emit("sl-load");
    }
  }
  render() {
    return this.svg;
  }
};
SlIcon.styles = icon_styles_default;
__decorateClass([
  r2()
], SlIcon.prototype, "svg", 2);
__decorateClass([
  n({ reflect: true })
], SlIcon.prototype, "name", 2);
__decorateClass([
  n()
], SlIcon.prototype, "src", 2);
__decorateClass([
  n()
], SlIcon.prototype, "label", 2);
__decorateClass([
  n({ reflect: true })
], SlIcon.prototype, "library", 2);
__decorateClass([
  watch("label")
], SlIcon.prototype, "handleLabelChange", 1);
__decorateClass([
  watch(["name", "src", "library"])
], SlIcon.prototype, "setIcon", 1);

// src/internal/scrollend-polyfill.ts
var debounce = (fn, delay) => {
  let timerId = 0;
  return function(...args) {
    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => {
      fn.call(this, ...args);
    }, delay);
  };
};
var decorate = (proto, method, decorateFn) => {
  const superFn = proto[method];
  proto[method] = function(...args) {
    superFn.call(this, ...args);
    decorateFn.call(this, superFn, ...args);
  };
};
var isSupported = "onscrollend" in window;
if (!isSupported) {
  const pointers = /* @__PURE__ */ new Set();
  const scrollHandlers = /* @__PURE__ */ new WeakMap();
  const handlePointerDown = (event) => {
    pointers.add(event.pointerId);
  };
  const handlePointerUp = (event) => {
    pointers.delete(event.pointerId);
  };
  document.addEventListener("pointerdown", handlePointerDown);
  document.addEventListener("pointerup", handlePointerUp);
  decorate(EventTarget.prototype, "addEventListener", function(addEventListener, type) {
    if (type !== "scroll")
      return;
    const handleScrollEnd = debounce(() => {
      if (!pointers.size) {
        this.dispatchEvent(new Event("scrollend"));
      } else {
        handleScrollEnd();
      }
    }, 100);
    addEventListener.call(this, "scroll", handleScrollEnd, { passive: true });
    scrollHandlers.set(this, handleScrollEnd);
  });
  decorate(EventTarget.prototype, "removeEventListener", function(removeEventListener, type) {
    if (type !== "scroll")
      return;
    const scrollHandler = scrollHandlers.get(this);
    if (scrollHandler) {
      removeEventListener.call(this, "scroll", scrollHandler, { passive: true });
    }
  });
}

// node_modules/lit/node_modules/lit-html/directives/map.js
function* o(o3, f) {
  if (void 0 !== o3) {
    let i = 0;
    for (const t of o3)
      yield f(t, i++);
  }
}

// node_modules/lit/node_modules/lit-html/directives/range.js
function* o2(o3, t, e3 = 1) {
  const i = void 0 === t ? 0 : o3;
  t != null ? t : t = o3;
  for (let o4 = i; e3 > 0 ? o4 < t : t < o4; o4 += e3)
    yield o4;
}

// src/components/carousel/carousel.component.ts
var SlCarousel = class extends ShoelaceElement {
  constructor() {
    super(...arguments);
    this.loop = false;
    this.navigation = false;
    this.pagination = false;
    this.autoplay = false;
    this.autoplayInterval = 3e3;
    this.slidesPerPage = 1;
    this.slidesPerMove = 1;
    this.orientation = "horizontal";
    this.mouseDragging = false;
    this.activeSlide = 0;
    this.autoplayController = new AutoplayController(this, () => this.next());
    this.scrollController = new ScrollController(this);
    // determines which slide is displayed
    // A map containing the state of all the slides
    this.intersectionObserverEntries = /* @__PURE__ */ new Map();
    this.localize = new LocalizeController2(this);
    this.handleSlotChange = (mutations) => {
      const needsInitialization = mutations.some(
        (mutation) => [...mutation.addedNodes, ...mutation.removedNodes].some(
          (el) => this.isCarouselItem(el) && !el.hasAttribute("data-clone")
        )
      );
      if (needsInitialization) {
        this.initializeSlides();
      }
      this.requestUpdate();
    };
  }
  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("role", "region");
    this.setAttribute("aria-label", this.localize.term("carousel"));
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          this.intersectionObserverEntries.set(entry.target, entry);
          const slide = entry.target;
          slide.toggleAttribute("inert", !entry.isIntersecting);
          slide.classList.toggle("--in-view", entry.isIntersecting);
          slide.setAttribute("aria-hidden", entry.isIntersecting ? "false" : "true");
        });
      },
      {
        root: this,
        threshold: 0.6
      }
    );
    this.intersectionObserver = intersectionObserver;
    intersectionObserver.takeRecords().forEach((entry) => {
      this.intersectionObserverEntries.set(entry.target, entry);
    });
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.intersectionObserver.disconnect();
    this.mutationObserver.disconnect();
  }
  firstUpdated() {
    this.initializeSlides();
    this.mutationObserver = new MutationObserver(this.handleSlotChange);
    this.mutationObserver.observe(this, {
      childList: true,
      subtree: true
    });
  }
  willUpdate(changedProperties) {
    if (changedProperties.has("slidesPerMove") || changedProperties.has("slidesPerPage")) {
      this.slidesPerMove = Math.min(this.slidesPerMove, this.slidesPerPage);
    }
  }
  getPageCount() {
    const slidesCount = this.getSlides().length;
    const { slidesPerPage, slidesPerMove, loop } = this;
    const pages = loop ? slidesCount / slidesPerMove : (slidesCount - slidesPerPage) / slidesPerMove + 1;
    return Math.ceil(pages);
  }
  getCurrentPage() {
    return Math.ceil(this.activeSlide / this.slidesPerMove);
  }
  canScrollNext() {
    return this.loop || this.getCurrentPage() < this.getPageCount() - 1;
  }
  canScrollPrev() {
    return this.loop || this.getCurrentPage() > 0;
  }
  /** @internal Gets all carousel items. */
  getSlides({ excludeClones = true } = {}) {
    return [...this.children].filter(
      (el) => this.isCarouselItem(el) && (!excludeClones || !el.hasAttribute("data-clone"))
    );
  }
  handleKeyDown(event) {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      const target = event.target;
      const isRtl = this.localize.dir() === "rtl";
      const isFocusInPagination = target.closest('[part~="pagination-item"]') !== null;
      const isNext = event.key === "ArrowDown" || !isRtl && event.key === "ArrowRight" || isRtl && event.key === "ArrowLeft";
      const isPrevious = event.key === "ArrowUp" || !isRtl && event.key === "ArrowLeft" || isRtl && event.key === "ArrowRight";
      event.preventDefault();
      if (isPrevious) {
        this.previous();
      }
      if (isNext) {
        this.next();
      }
      if (event.key === "Home") {
        this.goToSlide(0);
      }
      if (event.key === "End") {
        this.goToSlide(this.getSlides().length - 1);
      }
      if (isFocusInPagination) {
        this.updateComplete.then(() => {
          var _a;
          const activePaginationItem = (_a = this.shadowRoot) == null ? void 0 : _a.querySelector(
            '[part~="pagination-item--active"]'
          );
          if (activePaginationItem) {
            activePaginationItem.focus();
          }
        });
      }
    }
  }
  handleScrollEnd() {
    const slides = this.getSlides();
    const entries = [...this.intersectionObserverEntries.values()];
    const firstIntersecting = entries.find((entry) => entry.isIntersecting);
    if (this.loop && (firstIntersecting == null ? void 0 : firstIntersecting.target.hasAttribute("data-clone"))) {
      const clonePosition = Number(firstIntersecting.target.getAttribute("data-clone"));
      this.goToSlide(clonePosition, "auto");
    } else if (firstIntersecting) {
      const slideIndex = slides.indexOf(firstIntersecting.target);
      this.activeSlide = Math.ceil(slideIndex / this.slidesPerMove) * this.slidesPerMove;
    }
  }
  isCarouselItem(node) {
    return node instanceof Element && node.tagName.toLowerCase() === "sl-carousel-item";
  }
  initializeSlides() {
    const intersectionObserver = this.intersectionObserver;
    this.intersectionObserverEntries.clear();
    this.getSlides({ excludeClones: false }).forEach((slide, index) => {
      intersectionObserver.unobserve(slide);
      slide.classList.remove("--in-view");
      slide.classList.remove("--is-active");
      slide.setAttribute("aria-label", this.localize.term("slideNum", index + 1));
      if (slide.hasAttribute("data-clone")) {
        slide.remove();
      }
    });
    this.updateSlidesSnap();
    if (this.loop) {
      this.createClones();
    }
    this.getSlides({ excludeClones: false }).forEach((slide) => {
      intersectionObserver.observe(slide);
    });
    this.goToSlide(this.activeSlide, "auto");
  }
  createClones() {
    const slides = this.getSlides();
    const slidesPerPage = this.slidesPerPage;
    const lastSlides = slides.slice(-slidesPerPage);
    const firstSlides = slides.slice(0, slidesPerPage);
    lastSlides.reverse().forEach((slide, i) => {
      const clone = slide.cloneNode(true);
      clone.setAttribute("data-clone", String(slides.length - i - 1));
      this.prepend(clone);
    });
    firstSlides.forEach((slide, i) => {
      const clone = slide.cloneNode(true);
      clone.setAttribute("data-clone", String(i));
      this.append(clone);
    });
  }
  handelSlideChange() {
    const slides = this.getSlides();
    slides.forEach((slide, i) => {
      slide.classList.toggle("--is-active", i === this.activeSlide);
    });
    if (this.hasUpdated) {
      this.emit("sl-slide-change", {
        detail: {
          index: this.activeSlide,
          slide: slides[this.activeSlide]
        }
      });
    }
  }
  updateSlidesSnap() {
    const slides = this.getSlides();
    const slidesPerMove = this.slidesPerMove;
    slides.forEach((slide, i) => {
      const shouldSnap = (i + slidesPerMove) % slidesPerMove === 0;
      if (shouldSnap) {
        slide.style.removeProperty("scroll-snap-align");
      } else {
        slide.style.setProperty("scroll-snap-align", "none");
      }
    });
  }
  handleAutoplayChange() {
    this.autoplayController.stop();
    if (this.autoplay) {
      this.autoplayController.start(this.autoplayInterval);
    }
  }
  handleMouseDraggingChange() {
    this.scrollController.mouseDragging = this.mouseDragging;
  }
  /**
   * Move the carousel backward by `slides-per-move` slides.
   *
   * @param behavior - The behavior used for scrolling.
   */
  previous(behavior = "smooth") {
    this.goToSlide(this.activeSlide - this.slidesPerMove, behavior);
  }
  /**
   * Move the carousel forward by `slides-per-move` slides.
   *
   * @param behavior - The behavior used for scrolling.
   */
  next(behavior = "smooth") {
    this.goToSlide(this.activeSlide + this.slidesPerMove, behavior);
  }
  /**
   * Scrolls the carousel to the slide specified by `index`.
   *
   * @param index - The slide index.
   * @param behavior - The behavior used for scrolling.
   */
  goToSlide(index, behavior = "smooth") {
    const { slidesPerPage, loop, scrollContainer } = this;
    const slides = this.getSlides();
    const slidesWithClones = this.getSlides({ excludeClones: false });
    if (!slides.length) {
      return;
    }
    const newActiveSlide = loop ? (index + slides.length) % slides.length : clamp(index, 0, slides.length - 1);
    this.activeSlide = newActiveSlide;
    const nextSlideIndex = clamp(index + (loop ? slidesPerPage : 0), 0, slidesWithClones.length - 1);
    const nextSlide = slidesWithClones[nextSlideIndex];
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const nextSlideRect = nextSlide.getBoundingClientRect();
    scrollContainer.scrollTo({
      left: nextSlideRect.left - scrollContainerRect.left + scrollContainer.scrollLeft,
      top: nextSlideRect.top - scrollContainerRect.top + scrollContainer.scrollTop,
      behavior: prefersReducedMotion() ? "auto" : behavior
    });
  }
  render() {
    const { scrollController, slidesPerMove } = this;
    const pagesCount = this.getPageCount();
    const currentPage = this.getCurrentPage();
    const prevEnabled = this.canScrollPrev();
    const nextEnabled = this.canScrollNext();
    const isLtr = this.localize.dir() === "ltr";
    return x`
      <div part="base" class="carousel">
        <div
          id="scroll-container"
          part="scroll-container"
          class="${e2$1({
      carousel__slides: true,
      "carousel__slides--horizontal": this.orientation === "horizontal",
      "carousel__slides--vertical": this.orientation === "vertical"
    })}"
          style="--slides-per-page: ${this.slidesPerPage};"
          aria-busy="${scrollController.scrolling ? "true" : "false"}"
          aria-atomic="true"
          tabindex="0"
          @keydown=${this.handleKeyDown}
          @scrollend=${this.handleScrollEnd}
        >
          <slot></slot>
        </div>

        ${this.navigation ? x`
              <div part="navigation" class="carousel__navigation">
                <button
                  part="navigation-button navigation-button--previous"
                  class="${e2$1({
      "carousel__navigation-button": true,
      "carousel__navigation-button--previous": true,
      "carousel__navigation-button--disabled": !prevEnabled
    })}"
                  aria-label="${this.localize.term("previousSlide")}"
                  aria-controls="scroll-container"
                  aria-disabled="${prevEnabled ? "false" : "true"}"
                  @click=${prevEnabled ? () => this.previous() : null}
                >
                  <slot name="previous-icon">
                    <sl-icon library="system" name="${isLtr ? "chevron-left" : "chevron-right"}"></sl-icon>
                  </slot>
                </button>

                <button
                  part="navigation-button navigation-button--next"
                  class=${e2$1({
      "carousel__navigation-button": true,
      "carousel__navigation-button--next": true,
      "carousel__navigation-button--disabled": !nextEnabled
    })}
                  aria-label="${this.localize.term("nextSlide")}"
                  aria-controls="scroll-container"
                  aria-disabled="${nextEnabled ? "false" : "true"}"
                  @click=${nextEnabled ? () => this.next() : null}
                >
                  <slot name="next-icon">
                    <sl-icon library="system" name="${isLtr ? "chevron-right" : "chevron-left"}"></sl-icon>
                  </slot>
                </button>
              </div>
            ` : ""}
        ${this.pagination ? x`
              <div part="pagination" role="tablist" class="carousel__pagination" aria-controls="scroll-container">
                ${o(o2(pagesCount), (index) => {
      const isActive = index === currentPage;
      return x`
                    <button
                      part="pagination-item ${isActive ? "pagination-item--active" : ""}"
                      class="${e2$1({
        "carousel__pagination-item": true,
        "carousel__pagination-item--active": isActive
      })}"
                      role="tab"
                      aria-selected="${isActive ? "true" : "false"}"
                      aria-label="${this.localize.term("goToSlide", index + 1, pagesCount)}"
                      tabindex=${isActive ? "0" : "-1"}
                      @click=${() => this.goToSlide(index * slidesPerMove)}
                      @keydown=${this.handleKeyDown}
                    ></button>
                  `;
    })}
              </div>
            ` : ""}
      </div>
    `;
  }
};
SlCarousel.styles = carousel_styles_default;
SlCarousel.dependencies = { "sl-icon": SlIcon };
__decorateClass([
  n({ type: Boolean, reflect: true })
], SlCarousel.prototype, "loop", 2);
__decorateClass([
  n({ type: Boolean, reflect: true })
], SlCarousel.prototype, "navigation", 2);
__decorateClass([
  n({ type: Boolean, reflect: true })
], SlCarousel.prototype, "pagination", 2);
__decorateClass([
  n({ type: Boolean, reflect: true })
], SlCarousel.prototype, "autoplay", 2);
__decorateClass([
  n({ type: Number, attribute: "autoplay-interval" })
], SlCarousel.prototype, "autoplayInterval", 2);
__decorateClass([
  n({ type: Number, attribute: "slides-per-page" })
], SlCarousel.prototype, "slidesPerPage", 2);
__decorateClass([
  n({ type: Number, attribute: "slides-per-move" })
], SlCarousel.prototype, "slidesPerMove", 2);
__decorateClass([
  n()
], SlCarousel.prototype, "orientation", 2);
__decorateClass([
  n({ type: Boolean, reflect: true, attribute: "mouse-dragging" })
], SlCarousel.prototype, "mouseDragging", 2);
__decorateClass([
  e2(".carousel__slides")
], SlCarousel.prototype, "scrollContainer", 2);
__decorateClass([
  e2(".carousel__pagination")
], SlCarousel.prototype, "paginationContainer", 2);
__decorateClass([
  r2()
], SlCarousel.prototype, "activeSlide", 2);
__decorateClass([
  watch("loop", { waitUntilFirstUpdate: true }),
  watch("slidesPerPage", { waitUntilFirstUpdate: true })
], SlCarousel.prototype, "initializeSlides", 1);
__decorateClass([
  watch("activeSlide")
], SlCarousel.prototype, "handelSlideChange", 1);
__decorateClass([
  watch("slidesPerMove")
], SlCarousel.prototype, "updateSlidesSnap", 1);
__decorateClass([
  watch("autoplay")
], SlCarousel.prototype, "handleAutoplayChange", 1);
__decorateClass([
  watch("mouseDragging")
], SlCarousel.prototype, "handleMouseDraggingChange", 1);
/*! Bundled license information:

lit-html/directives/map.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/directives/range.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/

SlCarousel.define("sl-carousel");

/* generated by Svelte v3.59.1 */

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[2] = list[i].image;
	return child_ctx;
}

// (12:4) {#each carousel_items as { image }}
function create_each_block(ctx) {
	let sl_carousel_item;
	let img;
	let img_alt_value;
	let img_src_value;
	let t;

	return {
		c() {
			sl_carousel_item = element("sl-carousel-item");
			img = element("img");
			t = space();
			this.h();
		},
		l(nodes) {
			sl_carousel_item = claim_element(nodes, "SL-CAROUSEL-ITEM", {});
			var sl_carousel_item_nodes = children(sl_carousel_item);
			img = claim_element(sl_carousel_item_nodes, "IMG", { alt: true, src: true });
			t = claim_space(sl_carousel_item_nodes);
			sl_carousel_item_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(img, "alt", img_alt_value = /*image*/ ctx[2].alt);
			if (!src_url_equal(img.src, img_src_value = /*image*/ ctx[2].src)) attr(img, "src", img_src_value);
		},
		m(target, anchor) {
			insert_hydration(target, sl_carousel_item, anchor);
			append_hydration(sl_carousel_item, img);
			append_hydration(sl_carousel_item, t);
		},
		p(ctx, dirty) {
			if (dirty & /*carousel_items*/ 1 && img_alt_value !== (img_alt_value = /*image*/ ctx[2].alt)) {
				attr(img, "alt", img_alt_value);
			}

			if (dirty & /*carousel_items*/ 1 && !src_url_equal(img.src, img_src_value = /*image*/ ctx[2].src)) {
				attr(img, "src", img_src_value);
			}
		},
		d(detaching) {
			if (detaching) detach(sl_carousel_item);
		}
	};
}

function create_fragment(ctx) {
	let div;
	let sl_carousel;
	let each_value = /*carousel_items*/ ctx[0];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			div = element("div");
			sl_carousel = element("sl-carousel");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);

			sl_carousel = claim_element(div_nodes, "SL-CAROUSEL", {
				loop: true,
				navigation: true,
				pagination: true,
				class: true
			});

			var sl_carousel_nodes = children(sl_carousel);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(sl_carousel_nodes);
			}

			sl_carousel_nodes.forEach(detach);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			set_custom_element_data(sl_carousel, "loop", "");
			set_custom_element_data(sl_carousel, "navigation", "");
			set_custom_element_data(sl_carousel, "pagination", "");
			set_custom_element_data(sl_carousel, "class", "svelte-zq8i8e");
			attr(div, "class", "section-container");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, sl_carousel);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(sl_carousel, null);
				}
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*carousel_items*/ 1) {
				each_value = /*carousel_items*/ ctx[0];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(sl_carousel, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
			destroy_each(each_blocks, detaching);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { props } = $$props;
	let { carousel_items } = $$props;

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(1, props = $$props.props);
		if ('carousel_items' in $$props) $$invalidate(0, carousel_items = $$props.carousel_items);
	};

	return [carousel_items, props];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { props: 1, carousel_items: 0 });
	}
}

export { Component as default };
