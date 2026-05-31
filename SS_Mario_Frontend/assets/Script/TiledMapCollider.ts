const { ccclass, property } = cc._decorator;

@ccclass
export default class TiledMapCollider extends cc.Component {

  @property
  collisionLayerName: string = "collision";

  @property
  groupName: string = "GROUND";

  private tiledMap: cc.TiledMap = null;

  onLoad() {
    this.tiledMap = this.getComponent(cc.TiledMap);
    if (!this.tiledMap) {
      cc.warn("[TiledMapCollider] No TiledMap component on this node");
      return;
    }
    this.generateColliders();
  }

  private generateColliders() {
    var objectGroup = this.tiledMap.getObjectGroup(this.collisionLayerName);
    if (!objectGroup) {
      cc.warn("[TiledMapCollider] Object layer '" + this.collisionLayerName + "' not found. Make sure you created an Object Layer named '" + this.collisionLayerName + "' in Tiled.");
      return;
    }

    var objects = objectGroup.getObjects();
    var mapSize = this.tiledMap.getMapSize();
    var tileSize = this.tiledMap.getTileSize();
    var mapPixelH = mapSize.height * tileSize.height;
    var count = 0;

    for (var i = 0; i < objects.length; i++) {
      var obj = objects[i];
      if (!obj.width || !obj.height) { continue; }

      // Tiled 座標：左上角原點，Y 向下
      // Cocos 座標：左下角原點，Y 向上
      // TiledMap 節點的錨點在左上角 (0,1)，所以子節點的 Y 需要翻轉
      var x = obj.x + obj.width / 2;
      var y = mapPixelH - obj.y - obj.height / 2;

      var node = new cc.Node("Ground_" + count);
      node.parent = this.node;
      node.setPosition(x, y);
      node.group = this.groupName;

      var rb = node.addComponent(cc.RigidBody);
      rb.type = cc.RigidBodyType.Static;
      rb.enabledContactListener = true;

      var collider = node.addComponent(cc.PhysicsBoxCollider);
      collider.size = cc.size(obj.width, obj.height);
      collider.offset = cc.v2(0, 0);
      collider.apply();

      count++;
    }

    cc.log("[TiledMapCollider] Generated " + count + " colliders from '" + this.collisionLayerName + "' layer");
  }
}
