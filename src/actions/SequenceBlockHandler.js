(function (global) {
  'use strict';

  var SequenceBlockHandler = {
    _overlay: null,
    _selectionRect: null,
    _selectionHighlight: null,

    initOverlay: function (svgEl) {
      var old = svgEl.querySelector('#sequence-block-overlay');
      if (old) old.remove();

      var overlay = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      overlay.setAttribute('id', 'sequence-block-overlay');
      overlay.style.pointerEvents = 'none';
      svgEl.appendChild(overlay);
      this._overlay = overlay;

      var selectionRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      selectionRect.setAttribute('class', 'sequence-block-selection-rect');
      selectionRect.style.display = 'none';
      selectionRect.style.pointerEvents = 'none';
      overlay.appendChild(selectionRect);
      this._selectionRect = selectionRect;

      var selectionHighlight = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      selectionHighlight.setAttribute('class', 'sequence-block-selection-highlight');
      selectionHighlight.style.display = 'none';
      selectionHighlight.style.pointerEvents = 'none';
      overlay.appendChild(selectionHighlight);
      this._selectionHighlight = selectionHighlight;
    },

    hideSelectionHighlight: function () {
      if (this._selectionHighlight) this._selectionHighlight.style.display = 'none';
    },

    _showSelectionHighlight: function (bbox) {
      if (!this._selectionHighlight || !bbox) return;
      this._selectionHighlight.setAttribute('x', bbox.x);
      this._selectionHighlight.setAttribute('y', bbox.y);
      this._selectionHighlight.setAttribute('width', bbox.width);
      this._selectionHighlight.setAttribute('height', bbox.height);
      this._selectionHighlight.style.display = '';
    },

    _getSelectionBBox: function (selectedIndices, messages) {
      var pad = 12;
      var left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
      for (var i = 0; i < messages.length; i++) {
        if (selectedIndices.indexOf(messages[i].index) === -1) continue;
        var box = messages[i].hitBox || messages[i].bbox;
        if (!box) continue;
        left   = Math.min(left,   box.x);
        top    = Math.min(top,    box.y);
        right  = Math.max(right,  box.x + box.width);
        bottom = Math.max(bottom, box.y + box.height);
      }
      if (!isFinite(left)) return null;
      return { x: left - pad, y: top - pad, width: right - left + pad * 2, height: bottom - top + pad * 2 };
    },

    attach: function (svgEl, model, ctx, canvas) {
      if (!this._overlay) this.initOverlay(svgEl);
      this._bringOverlayToFront(svgEl);

      var messages = SequencePositionTracker.collectMessages(svgEl, model);
      this._renderBlockBadges(svgEl, model, ctx);
      this._attachSelection(svgEl, messages, ctx, canvas);

      if (ctx.watchSequenceSelectionHighlight) {
        ctx.watchSequenceSelectionHighlight();
      }
    },

    _attachSelection: function (svgEl, messages, ctx, canvas) {
      var self = this;

      // contextmenu는 svgEl과 canvas 모두 차단
      var suppressCtx = function (e) {
        if (e.target && e.target.closest && e.target.closest('#sequence-block-overlay .sequence-block-badge-hit')) return;
        e.preventDefault();
      };
      svgEl.addEventListener('contextmenu', suppressCtx);
      if (canvas) canvas.addEventListener('contextmenu', suppressCtx, true);

      // mousedown 리스너는 canvas(여백 포함)와 svgEl 양쪽에 붙인다.
      // canvas가 없으면 svgEl에만 붙임.
      var dragTarget = canvas || svgEl;
      dragTarget.addEventListener('mousedown', function (e) {
        if (e.button !== 2) return;
        if (e.target && e.target.closest && e.target.closest('.sequence-block-badge-hit')) return;
        // badge 영역의 우클릭은 배지 자체 핸들러로 위임
        e.preventDefault();
        e.stopPropagation();

        var start = SvgPositionTracker.getSVGPoint(svgEl, e.clientX, e.clientY);
        var currentSelection = [];

        self._selectionRect.style.display = '';
        self._updateSelectionRect(start, start);

        var onMove = function (me) {
          var current = SvgPositionTracker.getSVGPoint(svgEl, me.clientX, me.clientY);
          self._updateSelectionRect(start, current);
          currentSelection = self._collectSelectedMessages(start, current, messages);
          ctx.setState({
            selectedSequenceParticipantId: null,
            selectedSequenceMessageIndex: null,
            selectedSequenceBlockId: null,
            selectedSequenceMessageIndices: currentSelection.slice(),
            sequenceToolbar: null
          });
        };

        var onUp = function () {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          self._selectionRect.style.display = 'none';

          if (!currentSelection.length) {
            self.hideSelectionHighlight();
            ctx.setState({
              selectedSequenceMessageIndices: [],
              selectedSequenceBlockId: null
            });
            return;
          }

          var selBBox = self._getSelectionBBox(currentSelection, messages);
          self._showSelectionHighlight(selBBox);

          var toolbarPos = { x: 0, y: 0 };
          if (selBBox) {
            var center = SvgPositionTracker.svgToScreen(svgEl, selBBox.x + selBBox.width / 2, selBBox.y);
            toolbarPos.x = center.x;
            toolbarPos.y = center.y;
          }

          var enclosing = SequenceStatementUtils.findEnclosingBranchBlock(
            ctx.getModel ? ctx.getModel() : null,
            currentSelection
          );

          ctx.setState({
            selectedSequenceParticipantId: null,
            selectedSequenceMessageIndex: null,
            selectedSequenceBlockId: null,
            selectedSequenceMessageIndices: currentSelection.slice(),
            sequenceToolbar: {
              type: 'selection',
              messageIndices: currentSelection.slice(),
              parentKind: enclosing ? enclosing.kind : null,
              x: toolbarPos.x,
              y: toolbarPos.y
            }
          });
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    },

    _collectSelectedMessages: function (start, current, messages) {
      var left = Math.min(start.x, current.x);
      var right = Math.max(start.x, current.x);
      var top = Math.min(start.y, current.y);
      var bottom = Math.max(start.y, current.y);
      var selected = [];

      for (var i = 0; i < messages.length; i++) {
        var box = messages[i].hitBox || messages[i].bbox;
        if (!box) continue;
        var intersects = !(
          box.x + box.width < left ||
          box.x > right ||
          box.y + box.height < top ||
          box.y > bottom
        );
        if (intersects) selected.push(messages[i].index);
      }

      return selected;
    },

    _updateSelectionRect: function (start, current) {
      var left = Math.min(start.x, current.x);
      var top = Math.min(start.y, current.y);
      var width = Math.abs(current.x - start.x);
      var height = Math.abs(current.y - start.y);
      this._selectionRect.setAttribute('x', left);
      this._selectionRect.setAttribute('y', top);
      this._selectionRect.setAttribute('width', width);
      this._selectionRect.setAttribute('height', height);
    },

    _renderBlockBadges: function (svgEl, model, ctx) {
      var blocks = SequenceStatementUtils.listBlocks(model && model.statements);
      var labelTextEls = this._sortTextElementsByPosition(Array.prototype.slice.call(svgEl.querySelectorAll('.labelText')));
      var allLoopTextEls = this._sortTextElementsByPosition(Array.prototype.slice.call(svgEl.querySelectorAll('.loopText')));
      var usedLoopIndices = {};
      var stmts = model && model.statements;
      var blockBindings = [];

      // 1차: 모든 block의 메인 title(loop/alt/opt/par text)을 먼저 예약한다.
      // nested loop title이 outer alt의 branch title로 잘못 소비되지 않도록 한다.
      for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i];
        var labelEl = labelTextEls[i] || null;
        var mainTitleEl = this._findMatchingLoopText(labelEl, allLoopTextEls, usedLoopIndices);
        blockBindings.push({
          block: block,
          labelEl: labelEl,
          mainTitleEl: mainTitleEl
        });
      }

      // 2차: 메인 title을 제외한 나머지 loopText만 branch title에 순서대로 연결한다.
      for (var j = 0; j < blockBindings.length; j++) {
        var binding = blockBindings[j];
        var boundBlock = binding.block;
        var branchTitleEls = [];
        var branchStatements = [];
        for (var b = 0; b < boundBlock.branchIndices.length; b++) {
          branchTitleEls.push(this._findNextUnusedLoopText(allLoopTextEls, usedLoopIndices));
          var si = boundBlock.branchIndices[b];
          branchStatements.push(stmts && stmts[si] ? stmts[si] : {});
        }

        this._attachBlockElementInteractions(
          svgEl,
          boundBlock,
          binding.labelEl,
          binding.mainTitleEl,
          branchTitleEls,
          branchStatements,
          ctx
        );
      }

      // 3차: recognized 블록이 소비하지 못한 나머지 labelText = critical/break/box 등
      // 미지원 문법. 클릭 시 안내 alert만 표시한다.
      for (var k = blocks.length; k < labelTextEls.length; k++) {
        var unusedEl = labelTextEls[k];
        var unusedGroup = unusedEl && (unusedEl.closest ? unusedEl.closest('g') : unusedEl.parentNode);
        if (!unusedGroup) continue;
        unusedGroup.style.cursor = 'pointer';
        unusedGroup.style.pointerEvents = 'all';
        unusedGroup.addEventListener('click', function (e) {
          e.stopPropagation();
          if (ctx.showUnsupportedHint) ctx.showUnsupportedHint();
        });
      }
    },

    _sortTextElementsByPosition: function (elements) {
      return (elements || []).slice().sort(function (a, b) {
        var boxA = null;
        var boxB = null;

        try { boxA = a && a.getBBox ? a.getBBox() : null; } catch (e1) {}
        try { boxB = b && b.getBBox ? b.getBBox() : null; } catch (e2) {}

        if (!boxA && !boxB) return 0;
        if (!boxA) return 1;
        if (!boxB) return -1;

        var dy = boxA.y - boxB.y;
        if (Math.abs(dy) > 1) return dy;

        return boxA.x - boxB.x;
      });
    },

    _findMatchingLoopText: function (labelEl, allLoopTextEls, usedLoopIndices) {
      if (!labelEl || !labelEl.getBBox) return this._findNextUnusedLoopText(allLoopTextEls, usedLoopIndices);

      var labelBox;
      try {
        labelBox = labelEl.getBBox();
      } catch (e) {
        return this._findNextUnusedLoopText(allLoopTextEls, usedLoopIndices);
      }

      var bestEl = null;
      var bestIdx = -1;
      var bestDist = Infinity;

      for (var i = 0; i < allLoopTextEls.length; i++) {
        if (usedLoopIndices[i]) continue;
        var loopEl = allLoopTextEls[i];
        if (!loopEl || !loopEl.getBBox) continue;

        var loopBox;
        try {
          loopBox = loopEl.getBBox();
        } catch (e2) {
          continue;
        }

        var dist = Math.abs(loopBox.y - labelBox.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestEl = loopEl;
          bestIdx = i;
        }
      }

      if (bestIdx !== -1) usedLoopIndices[bestIdx] = true;
      return bestEl;
    },

    _findNextUnusedLoopText: function (allLoopTextEls, usedLoopIndices) {
      for (var i = 0; i < allLoopTextEls.length; i++) {
        if (usedLoopIndices[i]) continue;
        usedLoopIndices[i] = true;
        return allLoopTextEls[i];
      }
      return null;
    },

    _attachBlockElementInteractions: function (svgEl, block, labelEl, titleEl, branchTitleEls, branchStatements, ctx) {
      // labelText의 부모 그룹(labelBox rect 포함)을 클릭 → toolbar
      var labelGroup = labelEl && (labelEl.closest ? labelEl.closest('g') : labelEl.parentNode);
      if (labelGroup) {
        labelGroup.style.cursor = 'pointer';
        labelGroup.style.pointerEvents = 'all';
        labelGroup.addEventListener('click', function (e) {
          e.stopPropagation();
          ctx.setState({
            selectedSequenceParticipantId: null,
            selectedSequenceMessageIndex: null,
            selectedSequenceMessageIndices: [],
            selectedSequenceBlockId: block.id,
            sequenceToolbar: {
              type: 'block',
              blockId: block.id,
              kind: block.kind,
              text: block.text || '',
              hasBranches: block.branchIndices.length > 0,
              x: e.clientX,
              y: e.clientY
            }
          });
        });
        if (ctx.watchSequenceBlockSelection) {
          ctx.watchSequenceBlockSelection(block.id, labelGroup);
        }
      }

      // 메인 title(loopText) 클릭 → 컨텍스트 툴바 (Edit / Delete)
      if (titleEl) {
        titleEl.style.cursor = 'pointer';
        titleEl.style.pointerEvents = 'all';
        titleEl.addEventListener('click', function (e) {
          e.stopPropagation();
          if (ctx.setState) {
            ctx.setState({
              selectedSequenceParticipantId: null,
              selectedSequenceMessageIndex: null,
              selectedSequenceMessageIndices: [],
              selectedSequenceBlockId: block.id,
              sequenceToolbar: {
                type: 'block-title',
                blockId: block.id,
                kind: block.kind,
                text: block.text || '',
                x: e.clientX,
                y: e.clientY
              }
            });
          }
        });
      }

      // 분기 title(loopText) 클릭 → 컨텍스트 툴바 (Edit / Delete)
      for (var b = 0; b < branchTitleEls.length; b++) {
        (function (branchEl, statementIndex, branchStmt) {
          if (!branchEl) return;
          branchEl.style.cursor = 'pointer';
          branchEl.style.pointerEvents = 'all';
          branchEl.addEventListener('click', function (e) {
            e.stopPropagation();
            if (ctx.setState) {
              ctx.setState({
                selectedSequenceParticipantId: null,
                selectedSequenceMessageIndex: null,
                selectedSequenceMessageIndices: [],
                selectedSequenceBlockId: block.id,
                sequenceToolbar: {
                  type: 'branch-title',
                  blockId: block.id,
                  statementIndex: statementIndex,
                  text: branchStmt.text || '',
                  x: e.clientX,
                  y: e.clientY
                }
              });
            }
          });
        }(branchTitleEls[b], block.branchIndices[b], branchStatements[b] || {}));
      }
    },

    _bringOverlayToFront: function (svgEl) {
      if (this._overlay && this._overlay.parentNode === svgEl) {
        svgEl.appendChild(this._overlay);
      }
    }
  };

  global.SequenceBlockHandler = SequenceBlockHandler;

})(typeof window !== 'undefined' ? window : this);
