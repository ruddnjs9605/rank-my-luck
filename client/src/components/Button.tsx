import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
  full?: boolean;
};
export default function Button({ variant="primary", full, className, ...rest }: Props){
  return (
    <button
      className={[
        "btn",
        variant==="primary"?"btn-primary":variant==="outline"?"btn-outline":"btn-ghost",
        full?"w-full":"", className??""
      ].join(" ").trim()}
      {...rest}
    />
  );
}
