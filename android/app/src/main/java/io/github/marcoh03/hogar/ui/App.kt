@file:OptIn(ExperimentalMaterial3Api::class)

package io.github.marcoh03.hogar.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.marcoh03.hogar.data.D
import io.github.marcoh03.hogar.data.Store
import io.github.marcoh03.hogar.data.today

@Composable
fun HogarApp() {
    observeStore()
    val snack = remember { SnackbarHostState() }
    LaunchedEffect(Unit) {
        Toast.messages.collect { msg ->
            snack.currentSnackbarData?.dismiss()
            snack.showSnackbar(msg)
        }
    }
    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Box(Modifier.fillMaxSize()) {
            if (!Store.onboarded) {
                OnboardingScreen()
            } else {
                val top = Nav.stack.lastOrNull()
                BackHandler(enabled = top != null) { Nav.pop() }
                val holder = rememberSaveableStateHolder()
                AnimatedContent(
                    targetState = top,
                    transitionSpec = {
                        if (Nav.forward) (slideInHorizontally { it / 4 } + fadeIn()) togetherWith fadeOut()
                        else fadeIn() togetherWith (slideOutHorizontally { it / 4 } + fadeOut())
                    },
                    label = "nav",
                ) { route ->
                    if (route == null) holder.SaveableStateProvider("main") { MainScaffold() } else RouteScreen(route)
                }
                WhoAmIGate()
            }
            SnackbarHost(snack, Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = 88.dp))
        }
    }
}

@Composable
private fun MainScaffold() {
    BackHandler(enabled = Nav.tab != Tab.HOME) { Nav.tab = Tab.HOME }
    Scaffold(
        bottomBar = {
            NavigationBar {
                Tab.entries.forEach { t ->
                    val badge = when (t) {
                        Tab.SHOP -> D.shoppingList().size
                        Tab.TASKS -> D.pendingTasks().count { (it.optString("due").ifEmpty { "9999" }) <= today() }
                        else -> 0
                    }
                    NavigationBarItem(
                        selected = Nav.tab == t,
                        onClick = { Nav.tab = t },
                        icon = {
                            BadgedBox(badge = { if (badge > 0) Badge { Text(if (badge > 99) "99+" else "$badge") } }) {
                                Icon(t.icon, contentDescription = null)
                            }
                        },
                        label = { Text(t.label) },
                    )
                }
            }
        },
    ) { pad ->
        Box(Modifier.padding(pad).consumeWindowInsets(pad).fillMaxSize()) {
            when (Nav.tab) {
                Tab.HOME -> HomeScreen()
                Tab.SHOP -> ShoppingScreen()
                Tab.TASKS -> TasksScreen()
                Tab.MONEY -> MoneyScreen()
                Tab.SETTINGS -> SettingsScreen()
            }
        }
    }
}

@Composable
private fun RouteScreen(r: Route) {
    when (r) {
        is Route.ItemEdit -> ItemEditor(r.id, r.onList)
        is Route.Buy -> BuyEditor(r.itemId)
        is Route.TaskEdit -> TaskEditor(r.id, r.assignee)
        is Route.Txn -> TxnEditor(r)
        is Route.Transfer -> TransferEditor(r.id, r.from)
        is Route.Exchange -> ExchangeEditor(r.id, r.accountId)
        is Route.Account -> AccountScreen(r.id)
        is Route.AccountEdit -> AccountEditor(r.id)
        is Route.CategoryDetail -> CategoryScreen(r.id, r.month)
        is Route.Stats -> StatsScreen(r.month)
        Route.Rates -> RatesScreen()
        Route.Categories -> CategoriesScreen()
        is Route.CategoryEdit -> CategoryEditor(r.id)
        Route.Tags -> TagsScreen()
        is Route.TagEdit -> TagEditor(r.id)
        is Route.MemberEdit -> MemberEditor(r.id)
        Route.House -> HouseEditor()
        Route.Github -> GithubScreen()
        is Route.Join -> JoinScreen(r.code)
        Route.Share -> ShareScreen()
    }
}
