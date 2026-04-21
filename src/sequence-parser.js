/**
 * Mermaid 시퀀스 다이어그램 파서
 * sequenceDiagram 문법을 내부 모델로 변환한다.
 */

(function (global) {
  'use strict';

  var MESSAGE_RE = SequenceMessageCodec.MESSAGE_RE;

  function ensureParticipant(model, id, label) {
    if (!id || model._participantMap[id]) return;
    var participant = { id: id, label: label || id, kind: 'participant' };
    model.participants.push(participant);
    model._participantMap[id] = participant;
  }

  function parseParticipantLine(line, model) {
    var match = line.match(/^(participant|actor)\s+([A-Za-z0-9_\u3131-\uD79D]+)(?:\s+as\s+(.+))?$/);
    if (!match) return false;
    model.explicitParticipants = true;
    var id = match[2];
    var label = match[3] ? match[3].trim() : id;
    var kind = match[1]; // 'participant' | 'actor'
    if (!model._participantMap[id]) {
      var p = { id: id, label: label, kind: kind };
      model.participants.push(p);
      model._participantMap[id] = p;
    } else {
      model._participantMap[id].kind = kind;
      if (match[3]) model._participantMap[id].label = label;
    }
    return true;
  }

  function parseMessageLine(line, model) {
    var match = line.match(MESSAGE_RE);
    if (!match) return false;

    ensureParticipant(model, match[1], match[1]);
    ensureParticipant(model, match[3], match[3]);

    var message = {
      from: match[1],
      to: match[3],
      operator: match[2],
      text: (match[4] || '').trim()
    };
    model.messages.push(message);
    model.statements.push({
      type: 'message',
      message: Object.assign({}, message)
    });
    return true;
  }

  function parseActivationLine(line, model) {
    var match = line.match(/^(activate|deactivate)\s+([A-Za-z0-9_\u3131-\uD79D]+)$/i);
    if (!match) return false;
    ensureParticipant(model, match[2], match[2]);
    model.statements.push({
      type: match[1].toLowerCase(),
      participant: match[2]
    });
    return true;
  }

  function parseControlLine(line, model) {
    var match = line.match(/^(loop|alt|else|opt|par|and)(?:\s+(.+))?$/i);
    if (match) {
      model.statements.push({
        type: match[1].toLowerCase(),
        text: (match[2] || '').trim()
      });
      return true;
    }

    if (/^end$/i.test(line)) {
      model.statements.push({ type: 'end' });
      return true;
    }

    return false;
  }

  function parseSequence(script) {
    if (!script || typeof script !== 'string') {
      return {
        type: 'sequenceDiagram',
        explicitParticipants: false,
        participants: [],
        messages: [],
        statements: [],
        nodes: [],
        edges: []
      };
    }

    var lines = script.split('\n');
    var model = {
      type: 'sequenceDiagram',
      explicitParticipants: false,
      participants: [],
      messages: [],
      statements: [],
      nodes: [],
      edges: [],
      _participantMap: {}
    };
    var started = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.indexOf('%%') === 0) continue;

      if (!started) {
        if (/^sequenceDiagram$/i.test(line)) {
          started = true;
        }
        continue;
      }

      if (line === 'autonumber') { model.autonumber = true; continue; }
      if (parseParticipantLine(line, model)) continue;
      if (parseMessageLine(line, model)) continue;
      if (parseActivationLine(line, model)) continue;
      if (parseControlLine(line, model)) continue;
    }

    delete model._participantMap;
    return model;
  }

  global.SequenceParser = {
    parse: parseSequence
  };

})(typeof window !== 'undefined' ? window : this);
