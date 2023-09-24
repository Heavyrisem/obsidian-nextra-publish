const CLASS_PREFIX = 'nx';

const getClassName = (className: string) => [CLASS_PREFIX, className].join('-');

export default getClassName;
