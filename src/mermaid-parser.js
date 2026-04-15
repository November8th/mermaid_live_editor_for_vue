(function (global) {
  'use strict';

  var SHAPE_MAP = [
    { open: '((', close: '))', shape: 'double_circle' },
    { open: '([', close: '])', shape: 'stadium' },
    { open: '[[', close: ']]', shape: 'subroutine' },
    { open: '[(', close: ')]', shape: 'cylinder' },
    { open: '{{', close: '}}', shape: 'hexagon' },
    { open: '{', close: '}', shape: 'rhombus' },
    { open: '[/', close: '/]', shape: 'parallelogram' },
    { open: '[\\', close: '\\]', shape: 'parallelogram_alt' },
    { open: '[/', close: '\\]', shape: 'trapezoid' },
    { open: '[\\', close: '/]', shape: 'trapezoid_alt' },
    { open: '>', close: ']', shape: 'asymmetric' },
    { open: '(', close: ')', shape: 'round' },
    { open: '[', close: ']', shape: 'rect' }
  ];

  var EDGE_PATTERNS = [
    { regex: /^==\s+(.+?)\s*==>/, type: '==>', hasLabel: true },
    { regex: /^--\s+(.+?)\s*-->/, type: '-->', hasLabel: true },
    { regex: /^--\s+(.+?)\s*-\.->/, type: '-.->', hasLabel: true },
    { regex: /^--\s+(.+?)\s*---/, type: '---', hasLabel: true },
    { regex: /^==>\|([^|]*)\|/, type: '==>', hasLabel: true },
    { regex: /^==>\s*/, type: '==>', hasLabel: false },
    { regex: /^-->\|([^|]*)\|/, type: '-->', hasLabel: true },
    { regex: /^-->\s*/, type: '-->', hasLabel: false },
    { regex: /^-\.->\|([^|]*)\|/, type: '-.->', hasLabel: true },
    { regex: /^-\.->\s*/, type: '-.->', hasLabel: false },
    { regex: /^---\|([^|]*)\|/, type: '---', hasLabel: true },
    { regex: /^---\s*/, type: '---', hasLabel: false },
    { regex: /^-\.-\|([^|]*)\|/, type: '-.-', hasLabel: true },
    { regex: /^-\.-\s*/, type: '-.-', hasLabel: false },
    { regex: /^===\|([^|]*)\|/, type: '===', hasLabel: true },
    { regex: /^===\s*/, type: '===', hasLabel: false }
  ];

  function getShapeCandidates(rest) {
    var candidates = [];
    for (var i = 0; i < SHAPE_MAP.length; i++) {
      if (rest.indexOf(SHAPE_MAP[i].open) === 0) {
        candidates.push({ def: SHAPE_MAP[i], order: i });
      }
    }

    candidates.sort(function (a, b) {
      var openDiff = b.def.open.length - a.def.open.length;
      if (openDiff) return openDiff;
      var closeDiff = b.def.close.length - a.def.close.length;
      if (closeDiff) return closeDiff;
      return a.order - b.order;
    });

    return candidates;
  }

  function isEscapedChar(text, index) {
    var slashCount = 0;
    for (var i = index - 1; i >= 0 && text.charAt(i) === '\\'; i--) {
      slashCount++;
    }
    return (slashCount % 2) === 1;
  }

  // quoted label 안의 ] ) } 같은 문자를 종료 토큰으로 오인하지 않도록
  // escape를 건너뛰며 실제 닫는 quote 위치를 찾는다.
  function findQuotedClose(rest, openLen, closeToken) {
    for (var i = openLen + 1; i < rest.length; i++) {
      if (rest.charAt(i) !== '"' || isEscapedChar(rest, i)) continue;
      if (rest.substr(i + 1, closeToken.length) === closeToken) {
        return i;
      }
    }
    return -1;
  }

  // generator가 넣은 최소 escape(\" \\)만 복원한다.
  function decodeQuotedLabel(text) {
    var out = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === '\\' && i + 1 < text.length) {
        out += text.charAt(i + 1);
        i++;
      } else {
        out += ch;
      }
    }
    return out;
  }

  function parseNodeDef(str) {
    str = str.trim();
    if (!str) return null;

    var idMatch = str.match(/^([a-zA-Z_\u3131-\uD79D][a-zA-Z0-9_\u3131-\uD79D]*)/);
    if (!idMatch) return null;

    var id = idMatch[1];
    var rest = str.substring(id.length);

    if (!rest || /^[\s;]/.test(rest) || /^[-=.]/.test(rest) || rest.charAt(0) === '&') {
      return { id: id, text: id, shape: 'rect', endIndex: id.length, raw: id };
    }

    // 겹치는 bracket 문법({{ }}/{} , [/] 계열 등)은
    // 긴 토큰을 우선 보는 쪽이 오인식 위험이 적다.
    var candidates = getShapeCandidates(rest);
    for (var i = 0; i < candidates.length; i++) {
      var shapeDef = candidates[i].def;
      var openLen = shapeDef.open.length;
      var innerStart = rest.substring(openLen);
      var text;
      var totalLen;
      var closeIdx;

      if (innerStart.charAt(0) === '"') {
        var quoteIdx = findQuotedClose(rest, openLen, shapeDef.close);
        if (quoteIdx !== -1) {
          text = decodeQuotedLabel(rest.substring(openLen + 1, quoteIdx));
          totalLen = id.length + quoteIdx + 1 + shapeDef.close.length;
          return {
            id: id,
            text: text || id,
            shape: shapeDef.shape,
            endIndex: totalLen,
            raw: str.substring(0, totalLen)
          };
        }
      }

      closeIdx = rest.indexOf(shapeDef.close, openLen);
      if (closeIdx !== -1) {
        text = rest.substring(openLen, closeIdx).trim();
        totalLen = id.length + closeIdx + shapeDef.close.length;
        return {
          id: id,
          text: text || id,
          shape: shapeDef.shape,
          endIndex: totalLen,
          raw: str.substring(0, totalLen)
        };
      }
    }

    return { id: id, text: id, shape: 'rect', endIndex: id.length, raw: id };
  }

  function parseEdge(str) {
    str = str.trim();
    for (var i = 0; i < EDGE_PATTERNS.length; i++) {
      var pattern = EDGE_PATTERNS[i];
      var match = str.match(pattern.regex);
      if (match) {
        return {
          type: pattern.type,
          label: pattern.hasLabel ? match[1].trim() : '',
          endIndex: match[0].length
        };
      }
    }
    return null;
  }

  function parseStyleLine(line, model) {
    var match = line.match(/^style\s+([A-Za-z_\u3131-\uD79D][A-Za-z0-9_\u3131-\uD79D]*)\s+(.+)$/);
    if (!match || !model._nodeMap[match[1]]) return;
    var node = model._nodeMap[match[1]];
    var declarations = match[2].split(',');
    for (var i = 0; i < declarations.length; i++) {
      var parts = declarations[i].split(':');
      if (parts.length < 2) continue;
      var key = parts[0].trim();
      var value = parts.slice(1).join(':').trim();
      if (key === 'fill') node.fill = value;
    }
  }

  function parseLinkStyleLine(line, model) {
    var match = line.match(/^linkStyle\s+(\d+)\s+(.+)$/);
    if (!match) return;
    var edge = model.edges[parseInt(match[1], 10)];
    if (!edge) return;
    var declarations = match[2].split(',');
    for (var i = 0; i < declarations.length; i++) {
      var parts = declarations[i].split(':');
      if (parts.length < 2) continue;
      var key = parts[0].trim();
      var value = parts.slice(1).join(':').trim();
      if (key === 'stroke') edge.color = value;
    }
  }

  function parseFlowLine(line, model) {
    line = line.trim();
    if (!line) return;

    var remaining = line;
    var prevNodeId = null;

    while (remaining.length > 0) {
      remaining = remaining.trim();
      if (!remaining) break;

      var node = parseNodeDef(remaining);
      if (!node) break;

      if (!model._nodeMap[node.id]) {
        var nodeObj = { id: node.id, text: node.text, shape: node.shape };
        model.nodes.push(nodeObj);
        model._nodeMap[node.id] = nodeObj;
      } else if (node.text !== node.id || node.shape !== 'rect') {
        model._nodeMap[node.id].text = node.text;
        model._nodeMap[node.id].shape = node.shape;
      }

      remaining = remaining.substring(node.endIndex).trim();

      if (prevNodeId !== null && model._pendingEdge) {
        model.edges.push({
          from: prevNodeId,
          to: node.id,
          text: model._pendingEdge.label,
          type: model._pendingEdge.type
        });
        model._pendingEdge = null;
      }

      var edge = parseEdge(remaining);
      if (edge) {
        model._pendingEdge = edge;
        prevNodeId = node.id;
        remaining = remaining.substring(edge.endIndex).trim();
      } else {
        prevNodeId = null;
        model._pendingEdge = null;
        break;
      }
    }
  }

  function parseMermaid(script) {
    if (!script || typeof script !== 'string') {
      return { type: 'flowchart', direction: 'TD', nodes: [], edges: [] };
    }

    var trimmed = script.trim();
    if (/^sequenceDiagram\b/i.test(trimmed) && global.SequenceParser) {
      return global.SequenceParser.parse(script);
    }

    var lines = script.split('\n');
    var model = {
      type: 'flowchart',
      direction: 'TD',
      nodes: [],
      edges: [],
      _nodeMap: {},
      _pendingEdge: null
    };
    var started = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();

      if (!line || line.indexOf('%%') === 0) continue;
      if (line.indexOf('classDef') === 0 || line.indexOf('class ') === 0) continue;

      if (line.indexOf('style ') === 0) {
        parseStyleLine(line, model);
        continue;
      }

      if (line.indexOf('linkStyle ') === 0) {
        parseLinkStyleLine(line, model);
        continue;
      }

      if (!started) {
        var headerMatch = line.match(/^(?:graph|flowchart)\s+(TD|TB|BT|LR|RL)/i);
        if (headerMatch) {
          model.direction = headerMatch[1].toUpperCase();
          if (model.direction === 'TB') model.direction = 'TD';
          started = true;
          continue;
        }
        if (/^(?:graph|flowchart)\s*$/.test(line)) {
          started = true;
          continue;
        }
      }

      if (started) {
        if (line.indexOf('subgraph') === 0 || line === 'end') continue;
        parseFlowLine(line, model);
      }
    }

    delete model._nodeMap;
    delete model._pendingEdge;

    return model;
  }

  global.MermaidParser = {
    parse: parseMermaid
  };
})(typeof window !== 'undefined' ? window : this);
