import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, GripVertical, ArrowUp, ArrowDown, X } from 'lucide-react';

const LONG_PRESS_MS = 260;
const MOVE_THRESHOLD_PX = 8;
const POPOVER_WIDTH = 272;

function moveItemToIndex(list = [], key, targetIdx) {
  const fromIdx = list.indexOf(key);
  if (fromIdx === -1 || targetIdx < 0 || targetIdx >= list.length || fromIdx === targetIdx) {
    return null;
  }
  const next = [...list];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(targetIdx, 0, moved);
  return next;
}

function computePopoverCoords(rect) {
  const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - POPOVER_WIDTH - 12));
  const preferBelow = window.innerHeight - rect.bottom >= 220;
  const top = preferBelow ? rect.bottom + 8 : Math.max(12, rect.top - 208);
  return { top, left };
}

function findHoveredChipKey(chipRefs, clientX, clientY) {
  for (const [key, el] of Object.entries(chipRefs)) {
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (
      clientX >= rect.left - 4 &&
      clientX <= rect.right + 4 &&
      clientY >= rect.top - 4 &&
      clientY <= rect.bottom + 4
    ) {
      return key;
    }
  }
  return null;
}

/**
 * Resume section ordering control with long-press activation:
 * - Hold >= 260ms and drag across chips -> floating drag-and-drop reorder
 * - Hold >= 260ms and release in place -> floating order selector popover (1..N)
 */
export function SectionOrderControl({
  sectionOrder = [],
  hiddenSections = [],
  sectionLabels = {},
  onReorder,
  onToggleHidden,
}) {
  const [pressingKey, setPressingKey] = useState(null);
  const [heldKey, setHeldKey] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [dragHoverKey, setDragHoverKey] = useState(null);
  const [popover, setPopover] = useState(null);
  const [shortTapHint, setShortTapHint] = useState(false);

  const chipRefs = useRef({});
  const popoverRef = useRef(null);
  const hintTimerRef = useRef(null);
  const orderRef = useRef(sectionOrder);
  orderRef.current = sectionOrder;

  const sessionRef = useRef(null);
  const timerRef = useRef(null);
  const windowListenersRef = useRef(null);

  const clearHoldTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const detachWindowListeners = useCallback(() => {
    const active = windowListenersRef.current;
    if (!active) return;
    window.removeEventListener('pointermove', active.onMove);
    window.removeEventListener('pointerup', active.onEnd);
    window.removeEventListener('pointercancel', active.onEnd);
    windowListenersRef.current = null;
  }, []);

  const resetPressState = useCallback(() => {
    clearHoldTimer();
    detachWindowListeners();
    sessionRef.current = null;
    setPressingKey(null);
    setHeldKey(null);
    setDragState(null);
    setDragHoverKey(null);
  }, [clearHoldTimer, detachWindowListeners]);

  useEffect(
    () => () => {
      resetPressState();
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    },
    [resetPressState],
  );

  useEffect(() => {
    if (!popover) return undefined;
    const handleOutside = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      const anchorEl = chipRefs.current[popover.secKey];
      if (anchorEl?.contains(e.target)) return;
      setPopover(null);
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setPopover(null);
    };
    document.addEventListener('pointerdown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [popover]);

  const applyMoveToIndex = useCallback(
    (secKey, targetIdx) => {
      const next = moveItemToIndex(orderRef.current, secKey, targetIdx);
      if (next) onReorder(next);
    },
    [onReorder],
  );

  const openPopoverForChip = useCallback((secKey) => {
    const el = chipRefs.current[secKey];
    if (!el) return;
    const coords = computePopoverCoords(el.getBoundingClientRect());
    setPopover({ secKey, ...coords });
  }, []);

  const handleChipPointerDown = (secKey, e) => {
    if (e.button !== undefined && e.button !== 0) return;
    resetPressState();

    const startX = e.clientX;
    const startY = e.clientY;
    sessionRef.current = {
      secKey,
      startX,
      startY,
      pointerType: e.pointerType || 'mouse',
      held: false,
      dragging: false,
    };
    setPressingKey(secKey);

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (!sessionRef.current || sessionRef.current.secKey !== secKey) return;
      sessionRef.current.held = true;
      setPressingKey(null);
      setHeldKey(secKey);
      setPopover(null);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(14);
      }
    }, LONG_PRESS_MS);

    const onMove = (moveEvent) => {
      const sess = sessionRef.current;
      if (!sess) return;
      const dx = moveEvent.clientX - sess.startX;
      const dy = moveEvent.clientY - sess.startY;
      const dist = Math.hypot(dx, dy);

      if (!sess.held) {
        if (dist > MOVE_THRESHOLD_PX) {
          resetPressState();
        }
        return;
      }

      if (!sess.dragging && dist > MOVE_THRESHOLD_PX) {
        sess.dragging = true;
      }
      if (sess.dragging) {
        setDragState({ secKey: sess.secKey, x: moveEvent.clientX, y: moveEvent.clientY });
        const hovered = findHoveredChipKey(chipRefs.current, moveEvent.clientX, moveEvent.clientY);
        setDragHoverKey(hovered);
      }
    };

    const onEnd = (endEvent) => {
      const sess = sessionRef.current;
      if (!sess) {
        resetPressState();
        return;
      }

      if (sess.dragging) {
        const hovered = findHoveredChipKey(chipRefs.current, endEvent.clientX, endEvent.clientY);
        if (hovered && hovered !== sess.secKey) {
          const targetIdx = orderRef.current.indexOf(hovered);
          if (targetIdx !== -1) applyMoveToIndex(sess.secKey, targetIdx);
        }
        resetPressState();
        return;
      }

      if (sess.held) {
        const chosenKey = sess.secKey;
        resetPressState();
        openPopoverForChip(chosenKey);
        return;
      }

      if (Math.hypot(endEvent.clientX - sess.startX, endEvent.clientY - sess.startY) <= MOVE_THRESHOLD_PX) {
        setShortTapHint(true);
        if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
        hintTimerRef.current = setTimeout(() => setShortTapHint(false), 1800);
      }
      resetPressState();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    windowListenersRef.current = { onMove, onEnd };
  };

  const handleChipKeyDown = (secKey, idx, e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPopoverForChip(secKey);
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      applyMoveToIndex(secKey, idx - 1);
    } else if (e.key === 'ArrowRight' && idx < sectionOrder.length - 1) {
      e.preventDefault();
      applyMoveToIndex(secKey, idx + 1);
    }
  };

  const activePopoverIdx = popover ? sectionOrder.indexOf(popover.secKey) : -1;
  const hoverTargetIdx = dragHoverKey ? sectionOrder.indexOf(dragHoverKey) : -1;

  return (
    <div className="mt-3 border-t border-teal-900/[0.08] pt-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-[11px] font-semibold text-[#2E484D]">模块顺序与显隐控制</span>
        <span
          className={`text-[10px] font-medium transition ${
            shortTapHint ? 'text-teal-700 font-semibold' : 'text-teal-700/80'
          }`}
        >
          {shortTapHint ? '请按住模块约 0.3 秒后松手选位或拖动调序' : '长按模块可浮动选位或拖拽调序'}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 select-none">
        {sectionOrder.map((secKey, idx) => {
          const isHidden = hiddenSections.includes(secKey);
          const isPressing = pressingKey === secKey;
          const isHeld = heldKey === secKey || popover?.secKey === secKey;
          const isDragSource = dragState?.secKey === secKey;
          const isDropTarget = Boolean(dragState && dragHoverKey === secKey && dragState.secKey !== secKey);

          let chipTone = isHidden
            ? 'border-slate-200 bg-slate-100/85 text-slate-400 hover:border-teal-200'
            : 'border-teal-900/12 bg-white/95 text-[#132A2E] hover:border-teal-300 hover:bg-teal-50/55';
          if (isDragSource) {
            chipTone = 'border-dashed border-teal-400 bg-teal-50/45 text-teal-600/70 opacity-50';
          } else if (isDropTarget) {
            chipTone = 'scale-[1.03] border-teal-500 bg-teal-50 text-teal-900 shadow-sm ring-2 ring-teal-400/80';
          } else if (isHeld) {
            chipTone = 'scale-[1.03] border-teal-500 bg-teal-50 text-teal-900 shadow-sm ring-2 ring-teal-300/80';
          } else if (isPressing) {
            chipTone = 'scale-[0.97] border-teal-400 bg-teal-50/80 text-teal-900 ring-2 ring-teal-200';
          }

          return (
            <div
              key={secKey}
              ref={(el) => {
                if (el) chipRefs.current[secKey] = el;
                else delete chipRefs.current[secKey];
              }}
              role="button"
              tabIndex={0}
              data-testid={`section-chip-${secKey}`}
              aria-label={`${sectionLabels[secKey]}，第 ${idx + 1} 位，长按调整顺序`}
              title="长按模块：松手可浮动选择序号，或直接拖动调换顺序"
              onPointerDown={(e) => handleChipPointerDown(secKey, e)}
              onKeyDown={(e) => handleChipKeyDown(secKey, idx, e)}
              onContextMenu={(e) => e.preventDefault()}
              className={`inline-flex cursor-grab items-center gap-1 rounded-xl border px-2 py-1 text-[11px] transition duration-150 touch-none active:cursor-grabbing ${chipTone}`}
            >
              <GripVertical className="h-3 w-3 shrink-0 text-teal-600/50" />
              <span
                className={`inline-flex h-4 min-w-4 items-center justify-center rounded-md px-1 text-[10px] font-bold tabular-nums ${
                  isHidden ? 'bg-slate-200/80 text-slate-500' : 'bg-teal-50 text-teal-700'
                }`}
              >
                {idx + 1}
              </span>
              <span className={isHidden ? 'line-through' : 'font-medium'}>
                {sectionLabels[secKey] || secKey}
              </span>
              <button
                type="button"
                data-testid={`section-toggle-hide-${secKey}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHidden(secKey);
                }}
                title={isHidden ? '点击显示该模块' : '点击隐藏该模块'}
                aria-label={isHidden ? `显示${sectionLabels[secKey]}` : `隐藏${sectionLabels[secKey]}`}
                className="ml-0.5 rounded p-0.5 transition hover:bg-teal-100/80"
              >
                {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3 text-teal-600" />}
              </button>
            </div>
          );
        })}
      </div>

      {/* Floating Drag Card */}
      {dragState &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-testid="section-drag-ghost"
            style={{ left: dragState.x, top: dragState.y, transform: 'translate(-50%, -50%)' }}
            className="no-print pointer-events-none fixed z-50 inline-flex items-center gap-1.5 rounded-xl border-2 border-teal-500 bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#132A2E] shadow-[0_18px_38px_-10px_rgba(13,148,136,0.45)] backdrop-blur-md"
          >
            <GripVertical className="h-3.5 w-3.5 text-teal-600" />
            <span>{sectionLabels[dragState.secKey] || dragState.secKey}</span>
            <span className="rounded-md bg-teal-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {hoverTargetIdx !== -1 && dragHoverKey !== dragState.secKey
                ? `放到第 ${hoverTargetIdx + 1} 位`
                : '拖至目标松手'}
            </span>
          </div>,
          document.body,
        )}

      {/* Floating Order Selector Popover */}
      {popover &&
        activePopoverIdx !== -1 &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            data-testid="section-order-popover"
            style={{ top: popover.top, left: popover.left, width: POPOVER_WIDTH }}
            className="no-print fixed z-50 rounded-2xl border border-teal-200/90 bg-white/95 p-3 shadow-[0_20px_44px_-12px_rgba(15,23,42,0.25)] backdrop-blur-md"
          >
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-[#132A2E]">
                调整「{sectionLabels[popover.secKey] || popover.secKey}」顺序
              </div>
              <button
                type="button"
                aria-label="关闭排序浮窗"
                onClick={() => setPopover(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-teal-50 hover:text-teal-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {sectionOrder.map((_, targetIdx) => {
                const isCurrent = targetIdx === activePopoverIdx;
                return (
                  <button
                    key={targetIdx}
                    type="button"
                    data-testid={`section-slot-${targetIdx + 1}`}
                    onClick={() => {
                      applyMoveToIndex(popover.secKey, targetIdx);
                      setPopover(null);
                    }}
                    className={`rounded-xl border px-2 py-1.5 text-[11px] font-semibold tabular-nums transition ${
                      isCurrent
                        ? 'border-teal-600 bg-teal-600 text-white shadow-xs'
                        : 'border-teal-900/10 bg-teal-50/45 text-[#132A2E] hover:border-teal-400 hover:bg-teal-100/75'
                    }`}
                  >
                    第 {targetIdx + 1} 位
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-1.5 border-t border-teal-900/[0.08] pt-2">
              <button
                type="button"
                disabled={activePopoverIdx === 0}
                onClick={() => applyMoveToIndex(popover.secKey, activePopoverIdx - 1)}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-teal-900/10 bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#2E484D] hover:border-teal-300 hover:bg-teal-50 disabled:opacity-35"
              >
                <ArrowUp className="h-3 w-3" />
                前移一位
              </button>
              <button
                type="button"
                disabled={activePopoverIdx === sectionOrder.length - 1}
                onClick={() => applyMoveToIndex(popover.secKey, activePopoverIdx + 1)}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-teal-900/10 bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#2E484D] hover:border-teal-300 hover:bg-teal-50 disabled:opacity-35"
              >
                <ArrowDown className="h-3 w-3" />
                后移一位
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
