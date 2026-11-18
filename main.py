import time
import random 

VALID_MOVES = {
    "Beach": {"Jungle", "Old Bridge"},
    "Jungle": {"Beach", "Cave"},
    "Cave": {"Jungle", "Old Bridge"},
    "Old Bridge": {"Beach", "Cave", "Lighthouse"},
    "Lighthouse": {"Old Bridge"},
}

ALLOWED_ITEMS = {
    "Jungle": "rope",
    "Cave": "lantern",
}


def display_introduction():
    print("======= @gamer======")
    print("loading", end="")
    for _ in range(4):
        print(".", end="", flush=True)
        time.sleep(0.3)
    print("\nwelcome to mystery island")


def player_name():
    while True:
        name = input("what is your name? ").strip()
        if name == "":
            print("name must not be empty try again ")
            continue
        return name


def new_game(name="Player"):
    return {
        "name": name,
        "location": "Beach",
        "energy": 5,
        "inventory": [],
        "won": False,
        "game_over": False,
    }


def display_inventory(player):
    print(f"{player['name']}'s inventory:")
    if not player["inventory"]:
        print("  empty")
    else:
        for item in player["inventory"]:
            print(f"  - {item}")


def move_player(player, destination):
    if player["game_over"]:
        return False, "The game is already over. Start a new game to play again."

    destination = destination.strip().title()
    if destination not in VALID_MOVES.get(player["location"], set()):
        return False, f"You cannot travel to {destination} from {player['location']}"

    if destination == "Lighthouse" and "rope" not in player["inventory"]:
        return False, "The bridge is locked. You need a rope to cross to the lighthouse."

    player["location"] = destination
    player["energy"] -= 1

    if player["energy"] <= 0:
        player["energy"] = 0
        player["game_over"] = True
        return True, f"You reach {destination}, but your energy is gone. You collapse on the island."

    return True, f"You move to {destination}. Energy left: {player['energy']}"


def collect_item(player, item_name=None):
    if player["game_over"]:
        return False, "The game is already over. Start a new game to play again."

    expected_item = ALLOWED_ITEMS.get(player["location"])
    item = item_name or expected_item

    if item is None:
        return False, "There is nothing useful to collect here."

    if item in player["inventory"]:
        return False, f"You already have the {item}."

    if player["location"] not in ALLOWED_ITEMS or ALLOWED_ITEMS[player["location"]] != item:
        return False, f"You cannot collect {item} here."

    player["inventory"].append(item)
    display_inventory(player)
    return True, f"You found the {item}!"


def cross_bridge(player):
    if player["game_over"]:
        return False, "The game is already over. Start a new game to play again."

    if player["location"] != "Old Bridge":
        return False, "You must stand at the Old Bridge to cross it."

    if "rope" not in player["inventory"]:
        return False, "The bridge is locked. You need a rope before you can cross."

    player["location"] = "Lighthouse"
    return True, "You cross the old bridge and reach the lighthouse."


def light_beacon(player):
    if player["game_over"]:
        return False, "The game is already over. Start a new game to play again."

    if player["location"] != "Lighthouse":
        return False, "You must be at the Lighthouse to light the beacon."

    if "lantern" not in player["inventory"]:
        return False, "The beacon is dark. You need a lantern to light it."

    player["won"] = True
    player["game_over"] = True
    return True, "You light the beacon. Rescue boat arrives. YOU WIN!"


def available_actions(player):
    actions = ["inventory", "quit"]
    location = player["location"]

    if location == "Beach":
        actions.extend(["move jungle", "move bridge"])
    elif location == "Jungle":
        actions.extend(["move beach", "move cave", "collect rope"])
    elif location == "Cave":
        actions.extend(["move jungle", "move bridge", "collect lantern"])
    elif location == "Old Bridge":
        actions.extend(["move beach", "move cave", "cross bridge"])
    elif location == "Lighthouse":
        actions.extend(["light beacon", "move bridge"])

    return actions


def apply_action(player, action):
    if player["game_over"]:
        return "The game is already over. Start a new game to play again."

    command = action.strip().lower()

    if command in {"quit", "exit", "q"}:
        player["game_over"] = True
        return "You decide to quit the island adventure."

    if command in {"inventory", "inv", "items"}:
        display_inventory(player)
        return "Inventory checked."

    if command in {"move beach", "go beach", "travel beach", "beach"}:
        success, message = move_player(player, "Beach")
        return message

    if command in {"move jungle", "go jungle", "travel jungle", "jungle"}:
        success, message = move_player(player, "Jungle")
        return message

    if command in {"move cave", "go cave", "travel cave", "cave"}:
        success, message = move_player(player, "Cave")
        return message

    if command in {"move bridge", "go bridge", "travel bridge", "old bridge", "bridge"}:
        success, message = move_player(player, "Old Bridge")
        return message

    if command in {"move lighthouse", "go lighthouse", "travel lighthouse", "lighthouse"}:
        success, message = move_player(player, "Lighthouse")
        return message

    if command in {"collect rope", "pick rope"}:
        success, message = collect_item(player, "rope")
        return message

    if command in {"collect lantern", "pick lantern"}:
        success, message = collect_item(player, "lantern")
        return message

    if command in {"cross bridge", "cross"}:
        success, message = cross_bridge(player)
        return message

    if command in {"light beacon", "light"}:
        success, message = light_beacon(player)
        return message

    if command in {"help", "menu", "actions"}:
        return "Actions: " + ", ".join(available_actions(player))

    return "Invalid choice. Try again."


def display_location(player):
    print(f"\nLocation: {player['location']}")
    print(f"Energy: {player['energy']}")
    print(f"Name: {player['name']}")

    if player["location"] == "Beach":
        print("You wake near the shore. Waves break on the sand.")
    elif player["location"] == "Jungle":
        print("The jungle is dense and full of mystery. You spot a rope hanging from a tree.")
    elif player["location"] == "Cave":
        print("A cool cave hides a lantern in the shadows.")
    elif player["location"] == "Old Bridge":
        print("The old bridge creaks over the river. It leads to the lighthouse.")
    elif player["location"] == "Lighthouse":
        print("The lighthouse tower rises above the island with a dark beacon.")

    print("Actions:", ", ".join(available_actions(player)))


def run_game(player):
    while not player["game_over"]:
        display_location(player)
        choice = input("Choose an action: ").strip()
        result = apply_action(player, choice)
        print(result)

        if player["won"]:
            print("The rescue boat is coming. You survive the island.")
            break

        if player["game_over"] and not player["won"]:
            print("Game over. The island claims another traveler.")
            break

    replay = input("Play again? (y/n): ").strip().lower()
    return replay in {"y", "yes"}


def setup_game():
    display_introduction()
    name = player_name()
    return new_game(name)


def main():
    print("=== THE LOST LIGHTHOUSE ===")
    while True:
        player = setup_game()
        should_continue = run_game(player)
        if not should_continue:
            print("Goodbye!")
            breake


if __name__ == "__main__":
    main()
