/**
 * MermaidToolbar component
 * Keeps the viewport controls separated from edit actions.
 */

Vue.component('mermaid-toolbar', {
  props: {
    diagramType: { type: String,  default: 'flowchart' },
    direction: { type: String,  default: 'TD' },
    canUndo:   { type: Boolean, default: false },
    canRedo:   { type: Boolean, default: false }
  },
  computed: {
    isFlowchart: function () {
      return this.diagramType !== 'sequenceDiagram';
    },
    titleText: function () {
      return this.isFlowchart ? 'Mermaid Preview' : 'Sequence Preview';
    }
  },
  methods: {
    addNode: function () { this.$emit('add-node'); },
    addSequenceParticipant: function () { this.$emit('add-sequence-participant'); },
    addSequenceMessage: function () { this.$emit('add-sequence-message'); },
    undo: function () { this.$emit('undo'); },
    redo: function () { this.$emit('redo'); },
    changeDirection: function (e) { this.$emit('change-direction', e.target.value); },
    zoomOut: function () { this.$emit('zoom-out'); },
    zoomIn: function () { this.$emit('zoom-in'); },
    fitView: function () { this.$emit('fit-view'); },
    copySvg: function () { this.$emit('copy-svg'); }
  },
  template: '\
    <div class="toolbar">\
      <div class="toolbar__main">\
        <div class="toolbar__title-block">\
          <div class="toolbar__eyebrow">Viewport</div>\
          <div class="toolbar__title">{{ titleText }}</div>\
        </div>\
        <div class="toolbar__group toolbar__group--zoom">\
          <button class="toolbar__icon-btn" @click="zoomOut" title="Zoom Out">-</button>\
          <button class="toolbar__icon-btn" @click="zoomIn" title="Zoom In">+</button>\
          <button class="toolbar__icon-btn toolbar__icon-btn--wide" @click="fitView" title="Fit to View">Fit</button>\
          <button class="toolbar__icon-btn toolbar__icon-btn--wide" @click="copySvg" title="Copy SVG">Copy</button>\
        </div>\
      </div>\
      <div class="toolbar__sub">\
        <div class="toolbar__group">\
          <button v-if="isFlowchart" class="toolbar__btn toolbar__btn--active" @click="addNode" title="Add Node (or double-click canvas)">\
            <span class="toolbar__btn-icon">+</span> Add Node\
          </button>\
          <button v-else class="toolbar__btn toolbar__btn--active" @click="addSequenceParticipant" title="Add participant">\
            <span class="toolbar__btn-icon">+</span> Participant\
          </button>\
          <button v-if="!isFlowchart" class="toolbar__btn" @click="addSequenceMessage" title="Add message">\
            <span class="toolbar__btn-icon">+</span> Message\
          </button>\
        </div>\
        <div class="toolbar__group">\
          <button class="toolbar__btn" @click="undo" :disabled="!canUndo" title="Undo (Ctrl+Z)">Undo</button>\
          <button class="toolbar__btn" @click="redo" :disabled="!canRedo" title="Redo (Ctrl+Y)">Redo</button>\
        </div>\
        <div v-if="isFlowchart" class="toolbar__group">\
          <select class="toolbar__select" :value="direction" @change="changeDirection" title="Layout direction">\
            <option value="TD">Top Down</option>\
            <option value="LR">Left Right</option>\
            <option value="BT">Bottom Top</option>\
            <option value="RL">Right Left</option>\
          </select>\
        </div>\
      </div>\
    </div>\
  '
});
