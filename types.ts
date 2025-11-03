export interface LevelFile {
  name: string;
  content: string;
}

export interface Level {
  id: number;
  title: string;
  description: string;
  files: LevelFile[];
  packages: string[];
  hints?: string[];
  solution?: { [filename: string]: string };
}

export interface Course {
  title: string;
  date: string;
  levels: Level[];
}
