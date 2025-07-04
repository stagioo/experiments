import {
  Router,
  Transport,
  Producer,
  Consumer,
  DataProducer,
  DataConsumer,
} from "mediasoup/node/lib/types";

export interface RoomPeer {
  id: string;
  transports: Transport[];
  producers: Producer[];
  consumers: Consumer[];
  dataProducers: DataProducer[];
  dataConsumers: DataConsumer[];
}

export class Room {
  public peers: Map<string, RoomPeer> = new Map();
  constructor(public id: string, public router: Router) {}

  addPeer(peerId: string) {
    if (!this.peers.has(peerId)) {
      this.peers.set(peerId, {
        id: peerId,
        transports: [],
        producers: [],
        consumers: [],
        dataProducers: [],
        dataConsumers: [],
      });
    }
    return this.peers.get(peerId)!;
  }

  getPeer(peerId: string) {
    return this.peers.get(peerId);
  }

  removePeer(peerId: string) {
    this.peers.delete(peerId);
  }
}
