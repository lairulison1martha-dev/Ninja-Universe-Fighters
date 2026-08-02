/**
 * Story mode manager: chapter/node progression and rewards.
 */

import { STORY, getChapter } from './data/story.js';
import saveManager from './save-manager.js';
import progression from './progression-manager.js';

class StoryManager extends EventTarget {
  chapters() {
    const save = saveManager.data;
    let prevDone = true;
    return STORY.chapters.map((c, i) => {
      const done = save.story.completedChapters.includes(c.id);
      const unlocked = i === 0 || !c.unlockAfter || save.story.completedChapters.includes(c.unlockAfter);
      const nodes = save.story.completedNodes[c.id] || [];
      const info = {
        id: c.id,
        index: i + 1,
        title: c.title,
        subtitle: c.subtitle,
        summary: c.summary,
        completed: done,
        unlocked,
        progress: c.nodes.length ? nodes.length / c.nodes.length : 0,
        nodeCount: c.nodes.length,
        completedNodes: nodes.length,
        rewards: c.rewards,
        requirement: unlocked ? '' : `Complete chapter ${i}`,
      };
      prevDone = done;
      return info;
    });
  }

  /** The next node to play in a chapter, or null when it is finished. */
  nextNode(chapterId) {
    const c = getChapter(chapterId);
    if (!c) return null;
    const done = saveManager.data.story.completedNodes[chapterId] || [];
    return c.nodes.find((n) => !done.includes(n.id)) || null;
  }

  /** Continue point across the whole campaign. */
  continuePoint() {
    for (const c of STORY.chapters) {
      const info = this.chapters().find((x) => x.id === c.id);
      if (!info.unlocked) continue;
      const node = this.nextNode(c.id);
      if (node) return { chapterId: c.id, node };
    }
    return null;
  }

  completeNode(chapterId, nodeId) {
    saveManager.update((d) => {
      const list = d.story.completedNodes[chapterId] || (d.story.completedNodes[chapterId] = []);
      if (!list.includes(nodeId)) list.push(nodeId);
      d.story.current = chapterId;
    });

    const c = getChapter(chapterId);
    const done = saveManager.data.story.completedNodes[chapterId] || [];
    const finished = c && done.length >= c.nodes.length;

    let rewards = null;
    if (finished && !saveManager.data.story.completedChapters.includes(chapterId)) {
      saveManager.update((d) => { d.story.completedChapters.push(chapterId); });
      rewards = progression.grantRewards(c.rewards);
      this.dispatchEvent(new CustomEvent('chapter-complete', { detail: { chapterId, rewards } }));
    }
    saveManager.save();
    return { finished, rewards };
  }

  resetChapter(chapterId) {
    saveManager.update((d) => {
      delete d.story.completedNodes[chapterId];
      const i = d.story.completedChapters.indexOf(chapterId);
      if (i >= 0) d.story.completedChapters.splice(i, 1);
    });
    saveManager.save();
  }

  get completedCount() { return saveManager.data.story.completedChapters.length; }
  get total() { return STORY.chapters.length; }
}

export const story = new StoryManager();
export default story;
