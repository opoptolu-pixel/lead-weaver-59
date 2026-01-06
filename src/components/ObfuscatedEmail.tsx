import { useState, useEffect } from "react";
import { Mail } from "lucide-react";

interface ObfuscatedEmailProps {
  className?: string;
  showIcon?: boolean;
  iconClassName?: string;
}

// Email parts encoded to prevent bot scraping
const ENCODED_USER = "aGVsbG8="; // base64 of "hello"
const ENCODED_DOMAIN = "Y2xlYW5kYS5jby51aw=="; // base64 of "cleanda.co.uk"

const decode = (encoded: string): string => {
  try {
    return atob(encoded);
  } catch {
    return "";
  }
};

export const useObfuscatedEmail = () => {
  const [email, setEmail] = useState("");

  useEffect(() => {
    // Decode only on client-side after mount
    const user = decode(ENCODED_USER);
    const domain = decode(ENCODED_DOMAIN);
    setEmail(`${user}@${domain}`);
  }, []);

  return email;
};

export const ObfuscatedEmail = ({ 
  className = "", 
  showIcon = false,
  iconClassName = "w-5 h-5"
}: ObfuscatedEmailProps) => {
  const email = useObfuscatedEmail();

  if (!email) {
    return <span className={className}>Loading...</span>;
  }

  return (
    <a 
      href={`mailto:${email}`} 
      className={className}
    >
      {showIcon && <Mail className={iconClassName} />}
      {email}
    </a>
  );
};

export const ObfuscatedEmailText = ({ className = "" }: { className?: string }) => {
  const email = useObfuscatedEmail();

  if (!email) {
    return <span className={className}>Loading...</span>;
  }

  return <span className={className}>{email}</span>;
};
