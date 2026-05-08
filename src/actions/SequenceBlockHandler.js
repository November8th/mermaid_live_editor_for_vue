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

    _getSelectionBBox: function (selectedIndices, messages, selectedNoteStatementIndices, notes) {
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
      for (var j = 0; j < (notes || []).length; j++) {
        if ((selectedNoteStatementIndices || []).indexOf(notes[j].statementIndex) === -1) continue;
        var nbox = notes[j].bbox;
        if (!nbox) continue;
        left   = Math.min(left,   nbox.x);
        top    = Math.min(top,    nbox.y);
        right  = Math.max(right,  nbox.x + nbox.width);
        bottom = Math.max(bottom, nbox.y + nbox.height);
      }
      if (!isFinite(left)) return null;
      return { x: left - pad, y: top - pad, width: right - left + pad * 2, height: bottom - top + pad * 2 };
    },

    attach: function (svgEl, model, ctx, canvas) {
      if (!this._overlay) this.initOverlay(svgEl);
      this._bringOverlayToFront(svgEl);

      var participantMap = SequencePositionTracker.collectParticipants(svgEl, model);
      var messages = SequencePositionTracker.collectMessages(svgEl, model);
      var notes    = SequencePositionTracker.collectNotePositions(svgEl, model);
      this._renderBlockBadges(svgEl, model, participantMap, ctx);
      this._attachSelection(svgEl, messages, notes, ctx, canvas);

      if (ctx.watchSequenceSelectionHighlight) {
        ctx.watchSequenceSelectionHighlight();
      }
    },

    _attachSelection: function (svgEl, messages, notes, ctx, canvas) {
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
        var currentNoteSelection = [];

        self._selectionRect.style.display = '';
        self._updateSelectionRect(start, start);

        var onMove = function (me) {
          var current = SvgPositionTracker.getSVGPoint(svgEl, me.clientX, me.clientY);
          self._updateSelectionRect(start, current);
          currentSelection = self._collectSelectedMessages(start, current, messages);
          currentNoteSelection = self._collectSelectedNotes(start, current, notes);
          ctx.setState({
            selectedSequenceParticipantId: null,
            selectedSequenceMessageIndex: null,
            selectedSequenceBlockId: null,
            selectedSequenceMessageIndices: currentSelection.slice(),
            selectedNoteStatementIndices: currentNoteSelection.slice(),
            sequenceToolbar: null
          });
        };

        var onUp = function () {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          self._selectionRect.style.display = 'none';

          if (!currentSelection.length && !currentNoteSelection.length) {
            self.hideSelectionHighlight();
            ctx.setState({
              selectedSequenceMessageIndices: [],
              selectedNoteStatementIndices: [],
              selectedSequenceBlockId: null
            });
            return;
          }

          var selBBox = self._getSelectionBBox(currentSelection, messages, currentNoteSelection, notes);
          self._showSelectionHighlight(selBBox);

          var toolbarPos = { x: 0, y: 0 };
          if (selBBox) {
            var center = SvgPositionTracker.svgToScreen(svgEl, selBBox.x + selBBox.width / 2, selBBox.y);
            toolbarPos.x = center.x;
            toolbarPos.y = center.y;
          }

          var enclosing = SequenceStatementUtils.findEnclosingBranchBlock(
            ctx.getModel ? ctx.getModel() : null,
            currentSelection,
            currentNoteSelection
          );

          ctx.setState({
            selectedSequenceParticipantId: null,
            selectedSequenceMessageIndex: null,
            selectedSequenceBlockId: null,
            selectedSequenceMessageIndices: currentSelection.slice(),
            selectedNoteStatementIndices: currentNoteSelection.slice(),
            sequenceToolbar: {
              type: 'selection',
              messageIndices: currentSelection.slice(),
              noteStatementIndices: currentNoteSelection.slice(),
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

    _collectSelectedNotes: function (start, current, notes) {
      var left = Math.min(start.x, current.x);
      var right = Math.max(start.x, current.x);
      var top = Math.min(start.y, current.y);
      var bottom = Math.max(start.y, current.y);
      var selected = [];

      for (var i = 0; i < (notes || []).length; i++) {
        var box = notes[i].bbox;
        if (!box) continue;
        var intersects = !(
          box.x + box.width < left ||
          box.x > right ||
          box.y + box.height < top ||
          box.y > bottom
        );
        if (intersects) selected.push(notes[i].statementIndex);
      }
      return selected;
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

    _renderBlockBadges: function (svgEl, model, participantMap, ctx) {
      var blocks = SequenceStatementUtils.listBlocks(model && model.statements);
      var labelTextEls = this._sortTextElementsByPosition(Array.prototype.slice.call(svgEl.querySelectorAll('.labelText')));
      var allLoopTextEls = this._sortTextElementsByPosition(Array.prototype.slice.call(svgEl.querySelectorAll('.loopText')));
      var usedLoopIndices = {};
      var stmts = model && model.statements;
      var blockBindings = [];

      // block title + 버튼용 overlay 및 공유 hover 상태
      var oldBtnOverlay = svgEl.querySelector('#sequence-block-insert-overlay');
      if (oldBtnOverlay) oldBtnOverlay.remove();
      var btnOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      btnOverlay.setAttribute('id', 'sequence-block-insert-overlay');
      svgEl.appendChild(btnOverlay);

      var shared = { btns: null, hideTimer: null };
      function sharedCancelHide() {
        if (shared.hideTimer !== null) { clearTimeout(shared.hideTimer); shared.hideTimer = null; }
      }
      function sharedHideNow() {
        sharedCancelHide();
        if (shared.btns) {
          for (var k = 0; k < shared.btns.length; k++) shared.btns[k].remove();
          shared.btns = null;
        }
      }
      function sharedScheduleHide() {
        sharedCancelHide();
        shared.hideTimer = setTimeout(function () { sharedHideNow(); }, 500);
      }

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
      // SVG의 loopText는 깊이 우선(안쪽 블록 branch label이 먼저)으로 렌더되므로
      // 가장 깊은 블록부터 처리해야 Y-order 소비 순서가 맞는다.
      var sortedBindings = blockBindings.slice().sort(function (a, b) {
        var da = a.block.depth !== undefined ? a.block.depth : 0;
        var db = b.block.depth !== undefined ? b.block.depth : 0;
        if (db !== da) return db - da; // 깊은 것 먼저
        return a.block.statementIndex - b.block.statementIndex;
      });

      for (var j = 0; j < sortedBindings.length; j++) {
        var binding = sortedBindings[j];
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
          ctx,
          model,
          participantMap,
          btnOverlay,
          shared,
          sharedCancelHide,
          sharedHideNow,
          sharedScheduleHide
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

    _attachBlockElementInteractions: function (svgEl, block, labelEl, titleEl, branchTitleEls, branchStatements, ctx, model, participantMap, btnOverlay, shared, sharedCancelHide, sharedHideNow, sharedScheduleHide) {
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

      // 메인 title(loopText) 클릭 → 컨텍스트 툴바 (Edit / Delete) + hover → + 버튼
      if (titleEl) {
        titleEl.style.cursor = 'pointer';
        titleEl.style.pointerEvents = 'all';

        var onTitleClick = function (e) {
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
        };
        titleEl.addEventListener('click', onTitleClick);

        // 투명 hit rect로 클릭/hover 영역 확장
        var hitRect = null;
        if (btnOverlay) {
          try {
            var titleBbox = titleEl.getBBox ? titleEl.getBBox() : null;
            if (titleBbox && titleBbox.width) {
              var PAD = 14;
              hitRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              hitRect.setAttribute('x', titleBbox.x - PAD);
              hitRect.setAttribute('y', titleBbox.y - PAD);
              hitRect.setAttribute('width', titleBbox.width + PAD * 2);
              hitRect.setAttribute('height', titleBbox.height + PAD * 2);
              hitRect.setAttribute('fill', 'transparent');
              hitRect.setAttribute('rx', '4');
              hitRect.style.pointerEvents = 'all';
              hitRect.style.cursor = 'pointer';
              btnOverlay.appendChild(hitRect);
              hitRect.addEventListener('click', onTitleClick);
            }
          } catch (e3) {}
        }

        if (btnOverlay && participantMap && SequenceSvgHandler) {
          var onTitleEnter = function () {
            var bbox;
            try { bbox = titleEl.getBBox ? titleEl.getBBox() : null; } catch (e2) {}
            if (!bbox || !bbox.width) return;
            sharedHideNow();

            // participant마다 + 버튼 하나씩, 각자의 lifeline cx에 배치
            var allBtns = [];
            var positions = [{ y: bbox.y + bbox.height + 12, isBefore: false }];
            var ids = Object.keys(participantMap);
            for (var pi = 0; pi < ids.length; pi++) {
              var p = participantMap[ids[pi]];
              if (!p) continue;
              var btns = SequenceSvgHandler._createNoteInsertButtons(
                btnOverlay, bbox, block.statementIndex, ids[pi],
                svgEl, model, participantMap, ctx,
                sharedCancelHide, sharedScheduleHide, p.cx, positions
              );
              for (var bi = 0; bi < btns.length; bi++) allBtns.push(btns[bi]);
            }
            shared.btns = allBtns;
          };
          titleEl.addEventListener('mouseenter', onTitleEnter);
          titleEl.addEventListener('mouseleave', sharedScheduleHide);

          // hit rect에도 동일한 이벤트 연결
          if (hitRect) {
            hitRect.addEventListener('mouseenter', onTitleEnter);
            hitRect.addEventListener('mouseleave', sharedScheduleHide);
          }
        }
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
