import unittest

from main import new_game, move_player, collect_item, cross_bridge, light_beacon


class TestMysteryIslandGame(unittest.TestCase):
    def test_new_game_starts_at_beach_with_five_energy(self):
        player = new_game("Ada")
        self.assertEqual(player["location"], "Beach")
        self.assertEqual(player["energy"], 5)
        self.assertEqual(player["inventory"], [])
        self.assertFalse(player["game_over"])

    def test_invalid_command_keeps_state_unchanged(self):
        player = new_game("Ada")
        before = {
            "location": player["location"],
            "energy": player["energy"],
            "inventory": list(player["inventory"]),
        }
        result = move_player(player, "Mountain")
        self.assertFalse(result[0])
        self.assertEqual(player["location"], before["location"])
        self.assertEqual(player["energy"], before["energy"])
        self.assertEqual(player["inventory"], before["inventory"])

    def test_legal_move_changes_location_and_energy(self):
        player = new_game("Ada")
        result = move_player(player, "Jungle")
        self.assertTrue(result[0])
        self.assertEqual(player["location"], "Jungle")
        self.assertEqual(player["energy"], 4)

    def test_wrong_direction_is_rejected_without_cost(self):
        player = new_game("Ada")
        player["location"] = "Beach"
        result = move_player(player, "Lighthouse")
        self.assertFalse(result[0])
        self.assertEqual(player["location"], "Beach")
        self.assertEqual(player["energy"], 5)

    def test_rope_can_be_collected_once(self):
        player = new_game("Ada")
        player["location"] = "Jungle"
        self.assertTrue(collect_item(player, "rope")[0])
        self.assertEqual(player["inventory"], ["rope"])
        self.assertFalse(collect_item(player, "rope")[0])

    def test_bridge_cannot_be_crossed_without_rope(self):
        player = new_game("Ada")
        player["location"] = "Old Bridge"
        result = cross_bridge(player)
        self.assertFalse(result[0])
        self.assertEqual(player["location"], "Old Bridge")

    def test_lighthouse_cannot_be_lit_without_lantern(self):
        player = new_game("Ada")
        player["location"] = "Lighthouse"
        player["inventory"] = ["rope"]
        result = light_beacon(player)
        self.assertFalse(result[0])
        self.assertFalse(player["won"])

    def test_correct_inventory_can_win(self):
        player = new_game("Ada")
        player["location"] = "Jungle"
        collect_item(player, "rope")
        player["location"] = "Cave"
        collect_item(player, "lantern")
        player["location"] = "Old Bridge"
        player["inventory"] = ["rope", "lantern"]
        cross_bridge(player)
        player["location"] = "Lighthouse"
        result = light_beacon(player)
        self.assertTrue(result[0])
        self.assertTrue(player["won"])

    def test_energy_exhaustion_causes_loss(self):
        player = new_game("Ada")
        player["energy"] = 1
        result = move_player(player, "Jungle")
        self.assertTrue(result[0])
        self.assertEqual(player["energy"], 0)
        self.assertTrue(player["game_over"])

    def test_replay_resets_state(self):
        player = new_game("Ada")
        player["inventory"] = ["rope", "lantern"]
        player["location"] = "Lighthouse"
        player["energy"] = 2
        fresh = new_game("Sam")
        self.assertEqual(fresh["location"], "Beach")
        self.assertEqual(fresh["energy"], 5)
        self.assertEqual(fresh["inventory"], [])


if __name__ == "__main__":
    unittest.main()
