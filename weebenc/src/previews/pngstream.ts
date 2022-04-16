import { Buffer } from "buffer"
import { Readable } from "stream"


const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const HEADER_SIZE = PNG_HEADER.length;

const CHUNK_NAME_SIZE = 4;
const CHUNK_LENGTH_SIZE = 4;
const CHUNK_HEADER_SIZE = CHUNK_NAME_SIZE + CHUNK_LENGTH_SIZE;
const CHUNK_CHECKSUM_SIZE = 4;

const END_CHUNK = "IEND";

const BUFFER_SIZE = 2 * 2 ** 20; // 2MiB

export function getPngBuffers(stream: Readable, callback: (buffer?: Buffer, size?: number) => void): Promise<void> {
    return new Promise((resolve) => {
        let currentImage = Buffer.alloc(BUFFER_SIZE);
        let chunkHeader = Buffer.alloc(CHUNK_HEADER_SIZE);

        let cur = {
            inPng: false,
            bytesRead: 0, // bytes read for the current image
            nextChunkPosition: HEADER_SIZE,
            iend: false // when this is true nextChunkPosition means EOF
        }; //holds current status

        stream.on('data', (buffer) => {
            for (let i = 0; i < buffer.length; i++) {
                // find the next valid PNG header
                if (!cur.inPng) {
                    if (buffer[i] == PNG_HEADER[cur.bytesRead]) {
                        cur.bytesRead++;
                        if (cur.bytesRead == HEADER_SIZE) {
                            cur.inPng = true;
                            PNG_HEADER.copy(currentImage, 0);
                        }

                    } else { //invalid header, reset
                        cur.bytesRead = 0;
                        cur = {
                            inPng: false,
                            bytesRead: 0,
                            nextChunkPosition: HEADER_SIZE,
                            iend: false
                        }
                    }
                } else { //in png

                    currentImage[cur.bytesRead] = buffer[i]; //copy byte to buffer
                    if (cur.iend && cur.bytesRead === cur.nextChunkPosition - 1) { //we have read the last byte; reset and call callback

                        const cbBuffer = Buffer.alloc(cur.bytesRead + 1);
                        currentImage.copy(cbBuffer, 0, 0, cur.bytesRead + 1);

                        callback(cbBuffer, cur.bytesRead);

                        currentImage.fill(0);
                        cur = {
                            inPng: false,
                            bytesRead: 0,
                            nextChunkPosition: HEADER_SIZE,
                            iend: false
                        }
                        i--; //wtf?
                        continue;
                    } else { //reading between the PNG header and IEND

                        if (cur.bytesRead >= cur.nextChunkPosition && cur.bytesRead - CHUNK_HEADER_SIZE < cur.nextChunkPosition) { //inside the chunk header
                            const chunkIndex = cur.bytesRead - cur.nextChunkPosition;
                            chunkHeader[chunkIndex] = buffer[i];

                            if (chunkIndex === (CHUNK_HEADER_SIZE - 1)) { // finished reading the chunk header
                                let size = chunkHeader.readUInt32BE(0);
                                let type = chunkHeader.subarray(CHUNK_LENGTH_SIZE, CHUNK_HEADER_SIZE).toString("ascii");

                                cur.nextChunkPosition += size + CHUNK_HEADER_SIZE + CHUNK_CHECKSUM_SIZE;

                                cur.iend = type === END_CHUNK;
                            }
                        }

                    }
                    cur.bytesRead++;
                }
            }
        })

        stream.on('close', () => {
            callback(undefined, undefined);
            resolve();
        })
    });
}