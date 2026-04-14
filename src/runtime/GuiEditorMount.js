var GuiEditor = global.GuiEditor || (global.GuiEditor = {});

GuiEditor.componentName = 'mermaid-full-editor';

GuiEditor.mount = function (target, options) {
  options = options || {};

  if (!global.Vue || !/^2\./.test(String(global.Vue.version || ''))) {
    throw new Error('GuiEditor.mount requires global Vue 2.');
  }

  var host = null;
  if (typeof target === 'string') {
    host = global.document.querySelector(target);
  } else if (target && target.nodeType === 1) {
    host = target;
  }

  if (!host) {
    throw new Error('GuiEditor.mount could not find the target element.');
  }

  if (host.__guiEditorMountInstance && typeof host.__guiEditorMountInstance.destroy === 'function') {
    host.__guiEditorMountInstance.destroy();
  }

  var mermaidInstance = global.mermaid;
  if (!mermaidInstance || typeof mermaidInstance.render !== 'function') {
    throw new Error('GuiEditor.mount requires global Mermaid to be loaded before mounting.');
  }

  if (options.initializeMermaid === true) {
    var defaultMermaidConfig = {
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      flowchart: {
        htmlLabels: true,
        curve: 'basis',
        padding: 15,
        nodeSpacing: 50,
        rankSpacing: 50,
        useMaxWidth: false
      },
      sequence: {
        useMaxWidth: false,
        diagramMarginY: 40,
        actorMargin: 80,
        messageMargin: 48
      }
    };

    var isPlainObject = function (value) {
      return !!value && Object.prototype.toString.call(value) === '[object Object]';
    };

    var mergeDeep = function (base, extra) {
      var merged = {};
      var key;

      base = base || {};
      extra = extra || {};

      for (key in base) {
        if (!Object.prototype.hasOwnProperty.call(base, key)) continue;
        merged[key] = base[key];
      }

      for (key in extra) {
        if (!Object.prototype.hasOwnProperty.call(extra, key)) continue;
        if (isPlainObject(merged[key]) && isPlainObject(extra[key])) {
          merged[key] = mergeDeep(merged[key], extra[key]);
        } else {
          merged[key] = extra[key];
        }
      }

      return merged;
    };

    mermaidInstance.initialize(mergeDeep(defaultMermaidConfig, options.mermaidConfig || {}));
  }

  var initialValue = '';
  if (options.initialValue !== undefined && options.initialValue !== null) {
    initialValue = String(options.initialValue);
  } else if (options.value !== undefined && options.value !== null) {
    initialValue = String(options.value);
  }

  var resolvedHeight = options.height;
  if (resolvedHeight === undefined || resolvedHeight === null || resolvedHeight === '') {
    resolvedHeight = '640px';
  } else if (typeof resolvedHeight === 'number') {
    resolvedHeight = resolvedHeight + 'px';
  } else {
    resolvedHeight = String(resolvedHeight);
  }

  var mountClasses = ['gui-editor-mount-root'];
  if (options.className) {
    mountClasses = mountClasses.concat(String(options.className).split(/\s+/).filter(Boolean));
  }

  var mountApi = null;

  var vm = new global.Vue({
    data: function () {
      return {
        currentValue: initialValue
      };
    },

    render: function (h) {
      var self = this;

      return h('div', {
        class: mountClasses,
        style: {
          width: '100%',
          height: resolvedHeight,
          minHeight: '0',
          display: 'flex'
        }
      }, [
        h('mermaid-full-editor', {
          props: {
            value: self.currentValue
          },
          on: {
            input: function (nextValue) {
              self.currentValue = nextValue;
              if (typeof options.onChange === 'function') {
                options.onChange(nextValue, mountApi);
              }
            }
          }
        })
      ]);
    }
  });

  vm.$mount();
  host.appendChild(vm.$el);

  mountApi = {
    setValue: function (nextValue) {
      if (!vm) return mountApi;
      vm.currentValue = nextValue == null ? '' : String(nextValue);
      return mountApi;
    },

    getValue: function () {
      if (!vm) return '';
      return vm.currentValue;
    },

    getRootElement: function () {
      if (!vm) return null;
      return vm.$el;
    },

    getVueInstance: function () {
      if (!vm) return null;
      return vm.$children[0] || null;
    },

    destroy: function () {
      if (!vm) return;

      var rootEl = vm.$el;
      vm.$destroy();

      if (rootEl && rootEl.parentNode) {
        rootEl.parentNode.removeChild(rootEl);
      }

      if (host.__guiEditorMountInstance === mountApi) {
        delete host.__guiEditorMountInstance;
      }

      vm = null;
    }
  };

  host.__guiEditorMountInstance = mountApi;

  if (typeof options.onMount === 'function') {
    options.onMount(mountApi);
  }

  return mountApi;
};
