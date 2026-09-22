type EmptyStateProps = {
  title: string;
  description: string;
};

function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

export { EmptyState };
