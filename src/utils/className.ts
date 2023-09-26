const CLASS_PREFIX = 'nx';

const getClassName = (...classNames: string[]) =>
  classNames.map((className) => [CLASS_PREFIX, className].join('-')).join(' ');

export default getClassName;
