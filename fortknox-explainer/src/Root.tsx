import React from 'react';
import {Composition} from 'remotion';
import {COMP, Main, MainProps} from './Main';

export const Root: React.FC = () => (
  <Composition
    id={COMP.id}
    component={Main}
    width={COMP.width}
    height={COMP.height}
    fps={COMP.fps}
    durationInFrames={COMP.durationInFrames}
    defaultProps={{withVoiceover: true, withMusic: true} satisfies MainProps}
  />
);
