type StatusIndicatorProps = {
  text?: string;
};

export function StatusIndicator({ text = 'Thinking' }: StatusIndicatorProps) {
  return (
    <div className="thinking-indicator">
      <div className="thinking-circle" />
      <span className="thinking-text">{text}</span>
    </div>
  );
}
