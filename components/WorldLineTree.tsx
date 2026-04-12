
import React from 'react';
import PostGameReportShell from './postGameReport/PostGameReportShell';
import type { WorldLineTreeProps } from './postGameReport/types';

const WorldLineTree: React.FC<WorldLineTreeProps> = (props) => {
  return <PostGameReportShell {...props} />;
};

export type { WorldLineTreeProps };
export default WorldLineTree;
