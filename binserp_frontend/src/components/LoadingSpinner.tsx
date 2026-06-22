export default function LoadingSpinner({ size = "md", color = "indigo" }: { size?: "sm" | "md" | "lg", color?: "indigo" | "white" }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  const colorClasses = {
    indigo: "border-indigo-200 border-t-indigo-600",
    white: "border-white/30 border-t-white",
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={`${sizeClasses[size]} ${colorClasses[color]} border-4 rounded-full animate-spin`}
      ></div>
    </div>
  );
}

