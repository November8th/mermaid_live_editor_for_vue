(function (global) {
  'use strict';

  var SIDES = ['top', 'right', 'bottom', 'left'];

  var PortDragHandler = {
    _overlay:   null,
    _dragLine:  null,

    // Call once per render, after SVG is in the DOM
    initOverlay: function (svgEl) {
      var old = svgEl.querySelector('#conn-port-overlay');
      if (old) old.remove();

      var overlay = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      overlay.setAttribute('id', 'conn-port-overlay');
      overlay.style.pointerEvents = 'none';
      svgEl.appendChild(overlay);
      this._overlay = overlay;

      var dragLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      dragLine.setAttribute('class', 'drag-edge-line');
      dragLine.setAttribute('stroke', '#818cf8');
      dragLine.setAttribute('stroke-width', '2.5');
      dragLine.setAttribute('stroke-dasharray', '6,4');
      dragLine.style.display   = 'none';
      dragLine.style.pointerEvents = 'none';
      overlay.appendChild(dragLine);
      this._dragLine = dragLine;
    },

    // Show 4 port circles around a node
    showPorts: function (svgEl, nodeId, positions, ctx) {
      if (!this._overlay) return;
      this._bringOverlayToFront(svgEl);
      this.clearPorts();

      var self = this;

      for (var s = 0; s < SIDES.length; s++) {
        (function (side) {
          var pt = SvgPositionTracker.getPortPosition(positions, nodeId, side);

          var setHovered = function (hovered) {
            circle.classList.toggle('port-hovered', hovered);
            glow.classList.toggle('port-hovered', hovered);
          };

          var onPointerDown = function (e) {
            e.preventDefault();
            e.stopPropagation();
            self._startDrag(svgEl, nodeId, pt, positions, ctx);
          };

          var onPointerEnter = function () {
            setHovered(true);
            ctx.setState({ portDragging: ctx.getState().portDragging }); // keep alive
          };

          var onPointerLeave = function () {
            setHovered(false);
          };

          // Invisible hit target
          var hit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          hit.setAttribute('class', 'conn-port-hit');
          hit.setAttribute('cx', pt.x);
          hit.setAttribute('cy', pt.y);
          hit.setAttribute('r', '11');
          hit.setAttribute('data-node-id', nodeId);
          hit.setAttribute('data-side', side);
          hit.style.cursor = 'crosshair';
          hit.style.pointerEvents = 'all';
          self._overlay.appendChild(hit);

          // Glow halo
          var glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          glow.setAttribute('class', 'conn-port-glow');
          glow.setAttribute('cx', pt.x);
          glow.setAttribute('cy', pt.y);
          glow.setAttribute('r', '10');
          glow.style.pointerEvents = 'none';
          self._overlay.appendChild(glow);

          // Port dot
          var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('class', 'conn-port');
          circle.setAttribute('cx', pt.x);
          circle.setAttribute('cy', pt.y);
          circle.setAttribute('r', '5');
          circle.setAttribute('data-node-id', nodeId);
          circle.setAttribute('data-side', side);
          circle.style.cursor = 'crosshair';
          circle.style.pointerEvents = 'none';
          self._overlay.appendChild(circle);

          hit.addEventListener('mousedown', onPointerDown);
          hit.addEventListener('mouseenter', onPointerEnter);
          hit.addEventListener('mouseleave', onPointerLeave);
        })(SIDES[s]);
      }
    },

    _startDrag: function (svgEl, fromNodeId, fromPt, positions, ctx) {
      var self = this;
      self._bringOverlayToFront(svgEl);
      ctx.setState({ portDragging: true });

      self._dragLine.setAttribute('x1', fromPt.x);
      self._dragLine.setAttribute('y1', fromPt.y);
      self._dragLine.setAttribute('x2', fromPt.x);
      self._dragLine.setAttribute('y2', fromPt.y);
      self._dragLine.style.display = '';

      var currentTarget = null;

      var onMove = function (me) {
        var svgPt = SvgPositionTracker.getSVGPoint(svgEl, me.clientX, me.clientY);
        self._dragLine.setAttribute('x2', svgPt.x);
        self._dragLine.setAttribute('y2', svgPt.y);

        var hit = self._findHitNode(svgPt.x, svgPt.y, fromNodeId, positions);
        if (hit !== currentTarget) {
          if (currentTarget) self._clearTargetHighlight(svgEl, currentTarget);
          currentTarget = hit;
          if (hit) self._highlightTarget(svgEl, hit);
        }
      };

      var onUp = function (me) {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);

        self._dragLine.style.display = 'none';
        if (currentTarget) self._clearTargetHighlight(svgEl, currentTarget);
        ctx.setState({ portDragging: false });

        var svgPt = SvgPositionTracker.getSVGPoint(svgEl, me.clientX, me.clientY);
        var target = self._findHitNode(svgPt.x, svgPt.y, fromNodeId, positions);
        if (target && target !== fromNodeId) {
          ctx.emit('add-edge', { from: fromNodeId, to: target });
        }

        // Re-show ports on the source node if still hovered
        setTimeout(function () {
          if (ctx.getState().hoveredNodeId === fromNodeId) {
            self.showPorts(svgEl, fromNodeId, positions, ctx);
          }
        }, 50);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },

    // Returns nodeId if (x,y) is inside or near a node, else null
    _findHitNode: function (x, y, excludeId, positions) {
      var SNAP = 28;
      var best = null;
      var bestDist = Infinity;

      for (var nodeId in positions) {
        if (nodeId === excludeId) continue;
        var p = positions[nodeId];

        // Inside bounding box
        if (x >= p.origTx + p.bboxX - 4 &&
            x <= p.origTx + p.bboxX + p.width  + 4 &&
            y >= p.origTy + p.bboxY - 4 &&
            y <= p.origTy + p.bboxY + p.height + 4) {
          return nodeId;
        }

        // Near center
        var d = Math.sqrt((x - p.cx) * (x - p.cx) + (y - p.cy) * (y - p.cy));
        if (d < SNAP && d < bestDist) {
          bestDist = d;
          best = nodeId;
        }
      }

      return best;
    },

    _highlightTarget: function (svgEl, nodeId) {
      // Use extractNodeId (which handles Mermaid 11's prefixed IDs) to find the right node
      var all = svgEl.querySelectorAll('.node');
      for (var j = 0; j < all.length; j++) {
        if (SvgPositionTracker.extractNodeId(all[j]) === nodeId) {
          all[j].classList.add('port-drag-target');
          return;
        }
      }
    },

    _clearTargetHighlight: function (svgEl, nodeId) {
      var targets = svgEl.querySelectorAll('.port-drag-target');
      for (var i = 0; i < targets.length; i++) {
        targets[i].classList.remove('port-drag-target');
      }
    },

    clearPorts: function () {
      if (!this._overlay) return;
      var ports = this._overlay.querySelectorAll('.conn-port, .conn-port-glow, .conn-port-hit');
      for (var i = 0; i < ports.length; i++) ports[i].remove();
    },

    _bringOverlayToFront: function (svgEl) {
      if (this._overlay && this._overlay.parentNode === svgEl) {
        svgEl.appendChild(this._overlay);
      }
    }
  };

  global.PortDragHandler = PortDragHandler;

})(typeof window !== 'undefined' ? window : this);
