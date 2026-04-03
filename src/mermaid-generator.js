/**
 * Mermaid Flowchart Generator
 * Converts internal model back to Mermaid script text.
 */

(function (global) {
  'use strict';

  // Shape to bracket mapping
  var SHAPE_BRACKETS = {
    rect: ['[', ']'],
    round: ['(', ')'],
    stadium: ['([', '])'],
    subroutine: ['[[', ']]'],
    cylinder: ['[(', ')]'],
    rhombus: ['{', '}'],
    hexagon: ['{{', '}}'],
    parallelogram: ['[/', '/]'],
    parallelogram_alt: ['[\\', '\\]'],
    trapezoid: ['[/', '\\]'],
    trapezoid_alt: ['[\\', '/]'],
    double_circle: ['((', '))'],
    asymmetric: ['>', ']'],
  };

  function escapeLabel(text) {
    return String(text)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
  }

  /**
   * Generate node definition string.
   */
  function generateNode(node) {
    var brackets = SHAPE_BRACKETS[node.shape] || SHAPE_BRACKETS.rect;
    var text = node.text || node.id;
    // If text equals id and shape is rect, just output bare id
    if (text === node.id && node.shape === 'rect') {
      return node.id;
    }
    // Use quoted labels consistently for non-bare node definitions.
    return node.id + brackets[0] + '"' + escapeLabel(text) + '"' + brackets[1];
  }

  /**
   * Generate the full Mermaid script from internal model.
   * Format:
   *   flowchart TD
   *   A["label"]          ← all nodes first
   *   B["label"]
   *   A --> B             ← then all edges
   *   C -- text --> D     ← labeled edges use "-- text -->" syntax
   */
  function generateMermaid(model) {
    if (!model) return '';

    var lines = [];
    var direction = model.direction || 'TD';
    lines.push('flowchart ' + direction);

    // 1. All node definitions
    if (model.nodes && model.nodes.length > 0) {
      for (var i = 0; i < model.nodes.length; i++) {
        lines.push('    ' + generateNode(model.nodes[i]));
      }
    }

    // 2. All edge definitions (node IDs only, no inline definitions)
    if (model.edges && model.edges.length > 0) {
      for (var j = 0; j < model.edges.length; j++) {
        var edge = model.edges[j];
        var edgeStr;
        if (edge.text) {
          // "-- label -->" format
          edgeStr = '-- ' + edge.text.trim() + ' ' + (edge.type || '-->');
        } else {
          edgeStr = edge.type || '-->';
        }
        lines.push('    ' + edge.from + ' ' + edgeStr + ' ' + edge.to);
      }
    }

    return lines.join('\n');
  }

  /**
   * Find node by id in nodes array.
   */
  function findNode(nodes, id) {
    if (!nodes) return null;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) return nodes[i];
    }
    return null;
  }

  // Export
  global.MermaidGenerator = {
    generate: generateMermaid,
    generateNode: generateNode
  };

})(typeof window !== 'undefined' ? window : this);
