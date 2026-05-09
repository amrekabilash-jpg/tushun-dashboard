import { ReactElement } from 'react';
import { ModuleId } from '../types';
import Module1 from './module1/Module1';
import Module2 from './module2/Module2';
import Module3 from './module3/Module3';
import Module4 from './module4/Module4';
import Module5 from './module5/Module5';
import Module6 from './module6/Module6';
import Module7 from './module7/Module7';
import Module8 from './module8/Module8';

const MODULES: Record<ModuleId, () => ReactElement> = {
  1: Module1,
  2: Module2,
  3: Module3,
  4: Module4,
  5: Module5,
  6: Module6,
  7: Module7,
  8: Module8,
};

export function getModuleComponent(id: ModuleId) {
  return MODULES[id];
}
