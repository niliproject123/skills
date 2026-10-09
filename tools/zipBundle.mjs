import {deflateRawSync} from 'node:zlib';
const table=Uint32Array.from({length:256},(_,index)=>{let value=index;for(let bit=0;bit<8;bit++)value=value&1?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
const crc32=data=>{let value=0xffffffff;for(const byte of data)value=table[(value^byte)&255]^(value>>>8);return (value^0xffffffff)>>>0;};
export function zipBundle(entries){
 const local=[],central=[];let offset=0,centralSize=0;
 if(entries.length>65535)throw new Error('Too many bundle entries for ZIP format.');
 for(const {name,data} of entries){
  if(!name.startsWith('kafka-city/')||name.includes('..')||name.includes('\\')||name.includes('\0'))throw new Error(`Invalid bundle path ${name}`);
  const filename=Buffer.from(name),compressed=deflateRawSync(data),checksum=crc32(data);
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(33,12);header.writeUInt32LE(checksum,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(filename.length,26);
  local.push(header,filename,compressed);
  const directory=Buffer.alloc(46);directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(0x800,8);directory.writeUInt16LE(8,10);directory.writeUInt16LE(33,14);directory.writeUInt32LE(checksum,16);directory.writeUInt32LE(compressed.length,20);directory.writeUInt32LE(data.length,24);directory.writeUInt16LE(filename.length,28);directory.writeUInt32LE(offset,42);
  central.push(directory,filename);offset+=header.length+filename.length+compressed.length;centralSize+=directory.length+filename.length;
 }
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,...central,end]);
}
