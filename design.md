This is a classic utility app scenario. The design needs to be **functional, clean, and state-aware** (meaning the user always knows what is happening).

I recommend a **Sidebar Layout** or a **Master-Detail Layout**. This scales better than a single window if you decide to add features later (like a dictionary, history search, or settings).

Here is a comprehensive UI/UX Design Specification for your Transcribe/Translate App.

---

### 1. High-Level Layout Structure

**Theme:** Clean, Modern (Dark Mode default recommended for video/media apps).
**Font:** Inter or San Francisco (System UI).

- **Sidebar (Left - 200px width):** Navigation (New Task, History, Settings).
- **Main Content Area (Right - Flex width):** Where the interaction happens.

---

### 2. Screen 1: "New Task" (The Input View)

This is the default view. It should feel lightweight and inviting.

**A. Header**

- Title: "Create New Task"
- Tabs/Toggle: **[ 🎥 Video Transcription ]** vs **[ 📄 Subtitle Translation ]**
  - _UX Note:_ Changing this toggle changes the input fields below slightly.

**B. Drop Zone (The Hero Element)**

- Large dashed-border box centered in the upper half.
- **Icon:** Cloud upload or File Icon.
- **Text:** "Drag and drop video/srt file here, or click to browse."
- **State (File Selected):**
  - Replace the dashed box with a **File Card**.
  - Show: File Icon, Filename (e.g., `movie_clip.mp4`), File Size (25MB), and an "X" button to remove.

**C. Configuration Panel (Below Drop Zone)**

- **Target Language:** A searchable dropdown (e.g., "English", "Spanish", "Japanese").
- **Model/Accuracy (Optional):** A simple segmented control: [Fast] | [Balanced] | [High Accuracy].
- **Output Path:** "Save to: /Downloads/Transcripts" (Clickable to change).

**D. Primary Action Bar (Bottom)**

- **Button:** "Start Processing" (Large, distinct color like Blue or Violet).
- **State:** Disabled if no file is uploaded. Changes to "Processing..." or redirects to the _History View_ upon click.

---

### 3. Screen 2: "Task Queue" (The Dashboard)

This is where the user spends time waiting or reviewing. It should look like a data grid or a clean list.

**Columns/List Structure:**

1. **File Info:** Icon (Video vs Text) + Filename.
2. **Task Type:** Badge (e.g., `TRANSCRIPT` in Blue, `TRANSLATE` in Purple).
3. **Target:** Language Code (e.g., `EN` → `ES`).
4. **Status/Progress:** The most important column.
5. **Actions:** Buttons (Download, Retry, Delete).

#### Status States (Crucial for your requirements)

- **State A: Processing (Ongoing)**
  - Visual: A progress bar (filled 45%) or a circular spinner.
  - Text: "Translating... (45%)"
  - Action: "Cancel" button (X icon).

- **State B: Completed (Success)**
  - Visual: Green Checkmark.
  - Text: "Completed"
  - Action 1: **Download/Export** (Primary Icon).
  - Action 2: **Open Folder** (Folder Icon).

- **State C: Failed (Error Handling)**
  - Visual: Red Warning Triangle.
  - Text: "Failed"
  - Interaction: **Hovering** over the red icon displays a Tooltip: _"Error: API Timeout" or "Error: File corrupted"_.
  - Action: **Retry Button** (Refresh Icon). This button re-queues the specific task with the same settings.

---

### 4. Figma-Ready Design Specs (Style Guide)

If you are building this in Figma or coding the CSS/Styling, use these specs:

**Color Palette (Modern Dark Theme):**

- **Background:** `#1E1E24` (Dark Grey)
- **Surface/Cards:** `#2B2B36` (Lighter Grey)
- **Primary (Action):** `#6C5CE7` (Soft Violet) — Use for "Start" and "Download".
- **Text Primary:** `#FFFFFF`
- **Text Secondary:** `#A0A0A0` (For metadata like file size).
- **Success:** `#00B894` (Mint Green)
- **Error:** `#FF7675` (Soft Red)
- **Border:** `#444450`

**Spacing & Metrics:**

- **Container Padding:** `24px`
- **Card Radius:** `12px` (Soft rounded corners).
- **Button Height:** `40px` or `48px` (Easy to click).

---

### 5. UX Micro-Interactions (The "Polish")

1. **The Error Reveal:**
   - Don't just show "Error."
   - **Design:** Create an "accordion" style row. If a task fails, the row can expand to show the log.
   - _Example:_ Click the failed row -> It slides down to reveal: _"Error Code 404: Translation service unreachable. Please check your internet connection."_

2. **Drag & Drop Feedback:**
   - When the user drags a file over the window, the _entire_ app overlay should light up or show a border saying "Drop file to start," so they don't have to aim for a specific tiny box.

3. **Toasts/Notifications:**
   - When a task finishes and the app is in the background, send a System Notification: _"Transcript for 'video.mp4' is ready."_

### 6. Layout Mockup (ASCII Representation)

```text
+----------------+---------------------------------------------------+
|  APP TITLE     |  [ New Task ]                                     |
|                |                                                   |
| [ + New Task ] |      +-------------------------------------+      |
| [ = Queue    ] |      |                                     |      |
| [ * Settings ] |      |      (Icon: Cloud Upload)           |      |
|                |      |    Drag Video or SRT file here      |      |
|                |      |                                     |      |
|                |      +-------------------------------------+      |
|                |                                                   |
|                |   Settings:                                       |
|                |   [ Target Lang: Spanish (ES) v ]                 |
|                |   [ Output: /Users/Name/Downloads ]               |
|                |                                                   |
|                |             [ START TASK > ]                      |
|                |                                                   |
+----------------+---------------------------------------------------+
```

```text
+----------------+---------------------------------------------------+
|  APP TITLE     |  [ Task Queue ]                                   |
|                |                                                   |
| [ + New Task ] |  Filter: [All] [Running] [Failed]                 |
| [ = Queue (3)] |                                                   |
| [ * Settings ] |  -----------------------------------------------  |
|                |  Video01.mp4    | EN->ES | [====..] 40% | [X]   |
|                |  -----------------------------------------------  |
|                |  Subtitle.srt   | EN->FR | [Success]    | [⬇]   |
|                |  -----------------------------------------------  |
|                |  Movie.mkv      | EN->JP | [Failed !]   | [⟳]   |
|                |    L Error: Audio track not found.                |
|                |  -----------------------------------------------  |
+----------------+---------------------------------------------------+
```
