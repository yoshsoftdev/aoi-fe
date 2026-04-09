import * as React from "react";
import { cn } from "@/lib/utils";

type TabsValue = string;

type TabsContextValue = {
  value: TabsValue | undefined;
  setValue: (value: TabsValue) => void;
  baseId: string;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: TabsValue;
  defaultValue?: TabsValue;
  onValueChange?: (value: TabsValue) => void;
}

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
  ...props
}: TabsProps) {
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState<TabsValue | undefined>(
    defaultValue
  );
  const baseId = React.useId();

  const currentValue = isControlled ? value : uncontrolledValue;

  const setValue = React.useCallback(
    (nextValue: TabsValue) => {
      onValueChange?.(nextValue);
      if (!isControlled) setUncontrolledValue(nextValue);
    },
    [isControlled, onValueChange]
  );

  return (
    <TabsContext.Provider value={{ value: currentValue, setValue, baseId }}>
      <div className={cn(className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

export function TabsList({ className, ...props }: TabsListProps) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "inline-flex items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: TabsValue;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, onClick, ...props }, ref) => {
    const ctx = React.useContext(TabsContext);
    if (!ctx) {
      throw new Error("TabsTrigger must be used within a Tabs component");
    }

    const isActive = ctx.value === value;
    const triggerId = `${ctx.baseId}-trigger-${value}`;
    const panelId = `${ctx.baseId}-panel-${value}`;

    return (
      <button
        ref={ref}
        id={triggerId}
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-controls={panelId}
        data-state={isActive ? "active" : "inactive"}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-50",
          "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
          "data-[state=inactive]:text-muted-foreground",
          className
        )}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) ctx.setValue(value);
        }}
        {...props}
      />
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: TabsValue;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, ...props }, ref) => {
    const ctx = React.useContext(TabsContext);
    if (!ctx) {
      throw new Error("TabsContent must be used within a Tabs component");
    }

    const isActive = ctx.value === value;
    const triggerId = `${ctx.baseId}-trigger-${value}`;
    const panelId = `${ctx.baseId}-panel-${value}`;

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={panelId}
        aria-labelledby={triggerId}
        hidden={!isActive}
        data-state={isActive ? "active" : "inactive"}
        className={cn("mt-2", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = "TabsContent";

