import Phaser from 'phaser';
import PreloadScene from './scenes/PreloadScene';
import IntroScene from './scenes/IntroScene';
import MainScene from './scenes/MainScene';
import SettingsScene from './scenes/SettingsScene';
import CharacterSelectScene from './scenes/CharacterSelectScene';
import CardGalleryScene from './scenes/CardGalleryScene';
import NodeEventScene from './scenes/NodeEventScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'game-container',
  scene: [PreloadScene, IntroScene, CharacterSelectScene, MainScene, SettingsScene, CardGalleryScene, NodeEventScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  dom: {
    createContainer: true
  }
};

new Phaser.Game(config);
