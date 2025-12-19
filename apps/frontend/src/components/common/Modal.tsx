/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import React, { useEffect, useState, useRef } from 'react';
import { X } from '@phosphor-icons/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeStyles = {
  sm: '400px',
  md: '500px',
  lg: '600px',
  xl: '700px',
};

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  if (!isOpen) return null;

  return (
    <div css={css`
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 3rem 1rem 1rem;
    `}>
      <div
        css={css`
          position: absolute;
          inset: 0;
          background: #000000;
          opacity: 0.85;
          cursor: pointer;
        `}
        onClick={onClose}
      />

      <div
        ref={modalRef}
        css={css`
          position: relative;
          width: 100%;
          max-width: ${sizeStyles[size]};
          max-height: 80vh;
          background: #0c0d10;
          border: 1px solid rgba(220, 253, 143, 0.25);
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transform: translate(${position.x}px, ${position.y}px);
          cursor: ${isDragging ? 'grabbing' : 'default'};
          transition: ${isDragging ? 'none' : 'transform 0.2s ease'};
        `}
      >
        {title && (
          <div 
            onMouseDown={handleMouseDown}
            css={css`
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 1.25rem 1.5rem;
              border-bottom: 1px solid rgba(220, 253, 143, 0.15);
              background: #0a0a0a;
              cursor: ${isDragging ? 'grabbing' : 'grab'};
              user-select: none;
            `}
          >
            <h3 css={css`
              font-size: 1.125rem;
              font-weight: 700;
              color: #dcfd8f;
              margin: 0;
            `}>
              {title}
            </h3>
            <button
              onClick={onClose}
              css={css`
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                background: transparent;
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 8px;
                color: #888;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                  background: rgba(255, 100, 100, 0.1);
                  border-color: rgba(255, 100, 100, 0.3);
                  color: #ff6464;
                }
              `}
            >
              <X size={18} weight="bold" />
            </button>
          </div>
        )}

        <div css={css`
          padding: 1.5rem;
          overflow-y: auto;
          flex: 1;
          background: #0c0d10;
          
          &::-webkit-scrollbar {
            width: 8px;
          }
          &::-webkit-scrollbar-track {
            background: #0a0a0a;
            border-radius: 4px;
          }
          &::-webkit-scrollbar-thumb {
            background: #dcfd8f;
            border-radius: 4px;
          }
          &::-webkit-scrollbar-thumb:hover {
            background: #b8e063;
          }
        `}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;
