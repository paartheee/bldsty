// Content moderation system

import Filter from "bad-words";
import { config } from "./config";

class ContentModerator {
  private filter: Filter;

  constructor() {
    this.filter = new Filter();
  }

  isSafe(text: string): boolean {
    if (!config.moderation.enabled) {
      return true;
    }

    if (!text || !text.trim()) {
      return false;
    }

    // Check length
    if (text.length > config.moderation.maxAnswerLength) {
      return false;
    }

    // Check profanity
    if (config.moderation.profanityFilterEnabled) {
      if (this.filter.isProfane(text)) {
        return false;
      }
    }

    return true;
  }

  sanitize(text: string): string {
    if (!config.moderation.profanityFilterEnabled) {
      return text.trim();
    }

    return this.filter.clean(text.trim());
  }

  getRejectionReason(text: string): string {
    if (!text || !text.trim()) {
      return "Answer cannot be empty";
    }

    if (text.length > config.moderation.maxAnswerLength) {
      return `Answer is too long (max ${config.moderation.maxAnswerLength} characters)`;
    }

    if (config.moderation.profanityFilterEnabled && this.filter.isProfane(text)) {
      return "Answer contains inappropriate content";
    }

    return "Answer does not meet safety requirements";
  }
}

// Export singleton
export const moderator = new ContentModerator();
