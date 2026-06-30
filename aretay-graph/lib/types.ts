export type TreeNode = {
  name: string;
  fromDeck?: boolean;
  count?: number;
  type?: string;
  cards?: string;
  note?: string;
  children?: TreeNode[];
  [key: string]: unknown;
};

export type SavedGraph = {
  id: string;
  createdAt: string;
  cardCount: number;
  root: TreeNode;
};

export type GraphListItem = {
  id: string;
  createdAt: string;
  cardCount: number;
  rootName: string;
};
