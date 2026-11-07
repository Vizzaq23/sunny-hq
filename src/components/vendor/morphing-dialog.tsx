// Motion Primitives Morphing Dialog, MIT (ibelick). Native-host accessibility adaptation.
'use client';

import React, {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  motion,
  AnimatePresence,
  MotionConfig,
  Transition,
  Variant,
  useReducedMotion,
} from 'motion/react';
import { createPortal } from 'react-dom';
import { cn } from './utils';
import { XIcon } from 'lucide-react';


export type MorphingDialogContextType = {
  setKeyboard:(keyboard:boolean)=>void;
  reduced: boolean;
  nativeModal: boolean;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  uniqueId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
};

const MorphingDialogContext =
  React.createContext<MorphingDialogContextType | null>(null);

function useMorphingDialog() {
  const context = useContext(MorphingDialogContext);
  if (!context) {
    throw new Error(
      'useMorphingDialog must be used within a MorphingDialogProvider'
    );
  }
  return context;
}

export type MorphingDialogProviderProps = {
  children: React.ReactNode;
  transition?: Transition;
  open?: boolean;
  onOpenChange?: (open:boolean)=>void;
  nativeModal?: boolean;
  reducedMotion?: boolean;
};

function MorphingDialogProvider({
  children,
  transition, open, onOpenChange, nativeModal=false, reducedMotion=false,
}: MorphingDialogProviderProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [keyboard,setKeyboard]=useState(false);
  const systemReduced=useReducedMotion();
  const reduced=Boolean(systemReduced||reducedMotion||keyboard);
  const isOpen=open??internalOpen;
  const setIsOpen=useCallback<React.Dispatch<React.SetStateAction<boolean>>>(value=>{const next=typeof value==='function'?value(isOpen):value;setInternalOpen(next);onOpenChange?.(next);},[isOpen,onOpenChange]);
  const uniqueId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null!);

  const contextValue = useMemo(
    () => ({
      setKeyboard, reduced, nativeModal, isOpen,
      setIsOpen,
      uniqueId,
      triggerRef,
    }),
    [isOpen, uniqueId, setIsOpen, reduced, nativeModal]
  );

  return (
    <MorphingDialogContext.Provider value={contextValue}>
      <MotionConfig reducedMotion={reduced?"always":"never"} transition={reduced?{duration:0}:transition}>{children}</MotionConfig>
    </MorphingDialogContext.Provider>
  );
}

export type MorphingDialogProps = MorphingDialogProviderProps;

function MorphingDialog(props:MorphingDialogProps) {
  return <MorphingDialogProvider {...props}/>;
}

export type MorphingDialogTriggerProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  triggerRef?: React.RefObject<HTMLButtonElement>;
  label?: string;
};

function MorphingDialogTrigger({
  children,
  className,
  style,
  triggerRef, label,
}: MorphingDialogTriggerProps) {
  const { setKeyboard, setIsOpen, isOpen, uniqueId, reduced, triggerRef:contextTrigger } = useMorphingDialog();

  const handleClick = useCallback((event:React.MouseEvent) => {
    setKeyboard(event.detail===0);
    setIsOpen(!isOpen);
  }, [isOpen, setIsOpen]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setKeyboard(true);
        setIsOpen(!isOpen);
      }
    },
    [isOpen, setIsOpen]
  );

  return (
    <motion.button
      ref={triggerRef??contextTrigger}
      layoutId={`dialog-${uniqueId}`}
      className={cn('relative cursor-pointer', className)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={style}
      aria-haspopup='dialog'
      aria-expanded={isOpen}
      aria-controls={`motion-ui-morphing-dialog-content-${uniqueId}`}
      aria-label={label}
    >
      {children}
    </motion.button>
  );
}

export type MorphingDialogContentProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

function MorphingDialogContent({
  children,
  className,
  style,
}: MorphingDialogContentProps) {
  // Native modal host owns dynamic focus containment, Escape and restore-focus.
  const { uniqueId, reduced, nativeModal } = useMorphingDialog();
  return (
    <motion.div
      layoutId={`dialog-${uniqueId}`}
      className={cn('overflow-hidden', className)}
      style={style}
      id={`motion-ui-morphing-dialog-content-${uniqueId}`}
      data-upstream='motion-primitives-morphing-dialog'
      data-layout-motion={!reduced}
      layoutScroll
      role={nativeModal?undefined:'dialog'}
      aria-modal={nativeModal?undefined:true}
      aria-labelledby={nativeModal?undefined:`motion-ui-morphing-dialog-title-${uniqueId}`}
      aria-describedby={nativeModal?undefined:`motion-ui-morphing-dialog-description-${uniqueId}`}
    >
      {children}
    </motion.div>
  );
}

export type MorphingDialogContainerProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

function MorphingDialogContainer({ children }: MorphingDialogContainerProps) {
  const { isOpen, uniqueId, nativeModal } = useMorphingDialog();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  if(nativeModal)return createPortal(<AnimatePresence initial={false}>{isOpen?children:null}</AnimatePresence>,document.querySelector('.app-shell')??document.body);

  return createPortal(
    <AnimatePresence initial={false} mode='sync'>
      {isOpen && (
        <>
          <motion.div
            key={`backdrop-${uniqueId}`}
            className='fixed inset-0 h-full w-full bg-white/40 backdrop-blur-xs dark:bg-black/40'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <div className='fixed inset-0 z-50 flex items-center justify-center'>
            {children}
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

export type MorphingDialogTitleProps = {
  dialogTitle?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

function MorphingDialogTitle({
  dialogTitle=false, children,
  className,
  style,
}: MorphingDialogTitleProps) {
  const { uniqueId, reduced } = useMorphingDialog();

  return (
    <motion.div
      id={dialogTitle?`motion-ui-morphing-dialog-title-${uniqueId}`:undefined}
      layoutId={`dialog-title-container-${uniqueId}`}
      className={className}
      style={style}
      layout
    >
      {children}
    </motion.div>
  );
}

export type MorphingDialogSubtitleProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

function MorphingDialogSubtitle({
  children,
  className,
  style,
}: MorphingDialogSubtitleProps) {
  const { uniqueId, reduced } = useMorphingDialog();

  return (
    <motion.div
      layoutId={reduced?undefined:`dialog-subtitle-container-${uniqueId}`}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

export type MorphingDialogDescriptionProps = {
  children: React.ReactNode;
  className?: string;
  disableLayoutAnimation?: boolean;
  variants?: {
    initial: Variant;
    animate: Variant;
    exit: Variant;
  };
};

function MorphingDialogDescription({
  children,
  className,
  variants,
  disableLayoutAnimation,
}: MorphingDialogDescriptionProps) {
  const { uniqueId, reduced } = useMorphingDialog();

  return (
    <motion.div
      key={`dialog-description-${uniqueId}`}
      layoutId={
        disableLayoutAnimation || reduced
          ? undefined
          : `dialog-description-content-${uniqueId}`
      }
      variants={variants}
      className={className}
      initial='initial'
      animate='animate'
      exit='exit'
      id={`motion-ui-morphing-dialog-description-${uniqueId}`}
    >
      {children}
    </motion.div>
  );
}

export type MorphingDialogImageProps = {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
};

function MorphingDialogImage({
  src,
  alt,
  className,
  style,
}: MorphingDialogImageProps) {
  const { uniqueId, reduced } = useMorphingDialog();

  return (
    <motion.img
      src={src}
      alt={alt}
      className={cn(className)}
      layoutId={reduced?undefined:`dialog-img-${uniqueId}`}
      style={style}
    />
  );
}

export type MorphingDialogCloseProps = {
  children?: React.ReactNode;
  className?: string;
  variants?: {
    initial: Variant;
    animate: Variant;
    exit: Variant;
  };
};

function MorphingDialogClose({
  children,
  className,
  variants,
}: MorphingDialogCloseProps) {
  const { setIsOpen, uniqueId } = useMorphingDialog();

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  return (
    <motion.button
      onClick={handleClose}
      type='button'
      aria-label='Close dialog'
      key={`dialog-close-${uniqueId}`}
      className={cn('absolute top-6 right-6', className)}
      initial='initial'
      animate='animate'
      exit='exit'
      variants={variants}
    >
      {children || <XIcon size={24} />}
    </motion.button>
  );
}

export {
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogClose,
  MorphingDialogTitle,
  MorphingDialogSubtitle,
  MorphingDialogDescription,
  MorphingDialogImage,
};
