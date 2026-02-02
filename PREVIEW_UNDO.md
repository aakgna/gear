# Preview and undo feed-level share changes

## Preview the changes

- **In terminal:**  
  `git diff app/feed.tsx components/games/GameWrapper.tsx components/GameIntroOverlay.tsx`

- **In Cursor/VS Code:**  
  Open the **Source Control** view and review the modified files, or use **Timeline** / **Compare** on each file.

## Keep the changes

- Stage and commit as usual, e.g.:  
  `git add app/feed.tsx components/games/GameWrapper.tsx components/GameIntroOverlay.tsx`  
  `git commit -m "Feed-level share pill (fixed like filter, welcome + puzzle intro)"`

## Undo the changes

- Restore the three files to their last committed version:  
  `git restore app/feed.tsx components/games/GameWrapper.tsx components/GameIntroOverlay.tsx`  
  or  
  `git checkout -- app/feed.tsx components/games/GameWrapper.tsx components/GameIntroOverlay.tsx`

- If you already staged them:  
  `git restore --staged app/feed.tsx components/games/GameWrapper.tsx components/GameIntroOverlay.tsx`  
  then run the `git restore` command above.
