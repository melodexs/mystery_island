import time
import random

inventory = []
def display_introduction():
    print("======= @gamer======")
    print("loading", end="")
    for i in range(4):
        print(".",end="",flush=True)
        time.sleep(1)
    print("\nwelcome to mystery island")
def player_name():
  while True:
        name = input("what is your name? ").strip()
        if name == "":
            print("name must not be empty try again ")
            continue 
        return name    

def creat_player(name):
    player = {
        "name": name,
        "energy": 5,
        "location": "Beach",
        "inventory": [],
        "raining": False,
        "temperature": 20
    }
    return player

def update_weather(player):
    player["temperature"] = random.randint(10,25)
    if player["temperature"] > 15:
        player["raining"] = False

    else:
        player["raining"] = True   

def display_weather(player):
    print(f"Temperature: {player['temperature']}°C")
    if player["raining"]:
       print("It is raining. You can't move!")
    else:
        print("the weather is clear ")

def monkey():
    display_introduction()
    name = player_name()
    player = creat_player(name)
    update_weather(player)
    display_weather(player)
monkey()    


def show_menu():
    print("\n=== THE LOST LIGHTHOUSE ===")
    print("1. Start game")
    print("2. Quit")


def start_game():
    print("\nYou wake up on a strange island.")
    print("Waves crash against the shore.")
    print("You are standing on the beach.")
    print("You see a forest ahead.")

    while True:
        won = explore()

        if won:
            print("The rescue boat has arrived")
            break

def collect_item():
    if "torch" in inventory:
        print("You already have a torch!")
    else:
        print("You found a torch!")
        inventory.append("torch")

    print("Your inventory:", inventory)


def collect_key():
    if "key" in inventory:
        print("You already have the key!")
    else:
        print("You found the Lighthouse key!")
        inventory.append("key")

    print("Your inventory:", inventory)


def cross_bridge():
    if "key" in inventory:
        print("The bridge unlocks! You can cross.")
        won = enter_lighthouse()
        return won
        
    else:
        print("The bridge is locked. Find the key first!")
        return False

def enter_lighthouse():
    if "key" in inventory and "torch" in inventory:
        print("You enter the lighthouse. You restore the beacon. YOU WIN!")
        return True

    else:
        print("You need the key and torch before entering!")
        return False

def collect_rope():
    if "rope" in inventory:
        print("You already have a rope!")

    else:
        print("You found a rope!")
        inventory.append("rope")

    print("Your inventory:", inventory)

def collect_map():
    if "map" in inventory:
        print("You already have a map!")
    else:
        print("You found an old map!")
        inventory.append("map")

    print("Your inventory:", inventory)

def cross_path():
    if "rope" in inventory:
        print("You use the rope to cross the dangerous path!")
    else:
        print("The path is too dangerous! You need a rope.")

def explore():
    print("\nWhere would you like to explore?")
    print("1. Beach")
    print("2. Jungle")
    print("3. Bridge")
    print("4. Cave")
    print("5. Mountain")

    location = input("Choose a location: ")

    if location == "1":
        print("\nYou are exploring the Beach.")
        collect_item()

    elif location == "2":
        print("\nYou are exploring the Jungle.")
        collect_key()

    elif location == "3":
        won = cross_bridge()
        return won 

    elif location == "4":
        print("\nYou are exploring the Cave.")
        collect_rope()
        cross_path()

    elif location == "5":
        print("\nYou are exploring the Mountain.")
        collect_map()    

    else:
        print("Invalid location!")
    return False


while True:
    display_introduction()
    show_menu()

    choice = input("Choose an option: ")

    if choice == "1":
        start_game()

    elif choice == "2":
        print("Goodbye!")
        break

    else:
        print("Invalid choice! Try again.")