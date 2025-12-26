import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PageVisit {
  page: string;
  enteredAt: string;
  leftAt?: string;
  timeSpent?: number;
}

export interface Visitor {
  visitorId: string;
  currentPage: string;
  userAgent: string;
  joinedAt: string;
  isAuthenticated: boolean;
  userId?: string | null;
  pageHistory?: PageVisit[];
  sessionDuration?: number;
}

interface PresenceState {
  [key: string]: Visitor[];
}

// Singleton channel manager
class ChannelManager {
  private static instance: ChannelManager;
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private listeners = new Set<(visitors: Visitor[]) => void>();
  private subscriberCount = 0;
  private isSubscribed = false;

  static getInstance(): ChannelManager {
    if (!ChannelManager.instance) {
      ChannelManager.instance = new ChannelManager();
    }
    return ChannelManager.instance;
  }

  subscribe(callback: (visitors: Visitor[]) => void) {
    this.listeners.add(callback);
    this.subscriberCount++;
    console.log("ChannelManager: subscriber added, total:", this.subscriberCount);

    if (!this.channel) {
      console.log("ChannelManager: creating channel");
      this.channel = supabase.channel("site-visitors");

      this.channel
        .on("presence", { event: "sync" }, () => {
          console.log("ChannelManager: presence sync");
          this.notifyListeners();
        })
        .on("presence", { event: "join" }, ({ newPresences }) => {
          console.log("ChannelManager: visitor joined", newPresences);
          this.notifyListeners();
        })
        .on("presence", { event: "leave" }, ({ leftPresences }) => {
          console.log("ChannelManager: visitor left", leftPresences);
          this.notifyListeners();
        })
        .subscribe((status) => {
          console.log("ChannelManager: subscription status:", status);
          if (status === "SUBSCRIBED") {
            this.isSubscribed = true;
            this.notifyListeners();
          }
        });
    }

    return () => this.unsubscribe(callback);
  }

  private unsubscribe(callback: (visitors: Visitor[]) => void) {
    this.listeners.delete(callback);
    this.subscriberCount--;
    console.log("ChannelManager: subscriber removed, remaining:", this.subscriberCount);

    if (this.subscriberCount <= 0 && this.channel) {
      console.log("ChannelManager: removing channel");
      supabase.removeChannel(this.channel);
      this.channel = null;
      this.isSubscribed = false;
      this.subscriberCount = 0;
    }
  }

  private notifyListeners() {
    if (!this.channel) return;
    
    const state = this.channel.presenceState() as PresenceState;
    const allVisitors: Visitor[] = [];
    
    Object.values(state).forEach((presences) => {
      presences.forEach((presence) => {
        allVisitors.push(presence as Visitor);
      });
    });

    console.log("ChannelManager: notifying", this.listeners.size, "listeners with", allVisitors.length, "visitors");
    this.listeners.forEach((callback) => callback(allVisitors));
  }

  getChannel() {
    return this.channel;
  }

  track(data: Visitor) {
    if (this.channel && this.isSubscribed) {
      console.log("ChannelManager: tracking", data.visitorId);
      return this.channel.track(data);
    }
    return Promise.resolve("not_subscribed");
  }
}

export const channelManager = ChannelManager.getInstance();

export function useVisitorData() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);

  useEffect(() => {
    const callback = (newVisitors: Visitor[]) => {
      setVisitors(newVisitors);
    };
    
    const unsubscribe = channelManager.subscribe(callback);
    
    return unsubscribe;
  }, []);

  return visitors;
}
